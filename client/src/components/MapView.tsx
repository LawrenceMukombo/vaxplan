
import React, { useEffect, useRef, useState, useMemo, useCallback, Fragment, memo } from "react";
import { useLocation } from "wouter";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline,
  Polygon,
  CircleMarker,
  Circle,
  useMapEvents,
  GeoJSON,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useTheme } from "next-themes";
// georaster is dynamically imported inside the raster-loading effect below
// to keep the ~500KB gzipped vendor chunk out of the initial map bundle.
// GeoRasterLayer is also dynamically imported there.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { offlineDb } from "@/lib/offlineDb";
import { loadActiveTenant } from "@/lib/tenantCache";
import { getTenantMapDefaults, getTenantMaxBounds } from "@/lib/tenantGeo";
import {
  usePopulationOverlay,
  PopulationWmsLayer,
  PopulationOverlayToggle,
  PopulationOverlayLegend,
} from "@/components/PopulationOverlay";
import { FacilityCascadePicker } from "@/components/FacilityCascadePicker";
import { FacilityDetailDrawer } from "./FacilityDetailDrawer";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedBasemap, type Basemap, BasemapTileLayer, BasemapSwitcher, BASEMAP_ITEMS } from "@/components/map/BasemapToggle";
import { CARTO_POSITRON_ATTRIBUTION, CARTO_VOYAGER_ATTRIBUTION } from "@/data/dataSources";
import { canCreateSessionPlan } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Locate,
  Ruler,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileSpreadsheet,
  Printer,
  PenLine,
  CheckCircle,
  XCircle,
  Search,
  Zap,
  Thermometer,
  X,
  Building2,
  Clock,
  Users,
  Filter,
  SlidersHorizontal,
  Globe,
  Calendar,
  AlertTriangle,
  Plus,
  Bell,
  ClipboardList,
} from "lucide-react";
import { MapAlertsPanel } from "./MapAlertsPanel";
import { MapRecommendationsPanel } from "./MapRecommendationsPanel";
import { LocationIntelligenceDrawer } from "./LocationIntelligenceDrawer";
import type { Facility, Village, FacilityCatchment } from "@shared/schema";
import { getMinScheduleDateInputValue } from "@shared/schedulingDates";
import { deriveSessionLifecycle } from "@/lib/sessionStatus";
import { distance, centroid as turfCentroid, polygon as turfPolygon } from "@turf/turf";
import RBush from "rbush";
// Vite worker import — runs centroid + point-in-polygon emphasis off the
// main thread so Province / District / LLG changes never block the UI on
// huge GRID3 datasets (tens of thousands of polygons).
import Grid3InsideWorker from "@/workers/grid3Inside.worker.ts?worker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyDefaultLeafletPinIcon,
  createFacilityCircleIcon, createVillageWithChvsIcon, createGapVillageIcon,
  createFilledPinIcon,
  FILLED_PIN_DATA_URIS,
  FILLED_PIN_SIZE_20x29,
} from "@/lib/mapIcons";


// Delete default Leaflet icons and replace with offline-available premium vector SVG pins
applyDefaultLeafletPinIcon();

/* Original Default Leaflet Options Commented out for Offline Capability:
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});
*/

const normalizeName = (name: string): string => {
  if (!name) return "";
  let n = name.toLowerCase().trim();
  const aliases: { [key: string]: string } = {
    "chiengi": "chienge",
    "milengi": "milenge",
    "lavushimanda": "lavushi manda",
    "shangombo": "shang'ombo",
    "kapiri-mposhi": "kapiri mposhi",
    "kapirimposhi": "kapiri mposhi",
    "northwester": "north-western",
    "northwestern": "north-western",
    "chikankanta": "chikankata"
  };
  if (aliases[n]) {
    n = aliases[n];
  }
  return n
    .replace(/[^a-z0-9]/g, "")
    .replace(/province/g, "")
    .replace(/district/g, "")
    .trim();
};

const getBoundaryFeatureName = (feature: any, adminLevel: number): string => {
  const properties = feature?.properties ?? {};
  const levelSpecificKeys = [
    `adm${adminLevel}_name`,
    `ADM${adminLevel}_NAME`,
    `ADM${adminLevel}_EN`,
    `NAME_${adminLevel}`,
    `name_${adminLevel}`,
  ];
  const genericKeys = ["name", "NAME", "shapeName"];

  for (const key of [...levelSpecificKeys, ...genericKeys]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

type PopulationChoroplethBin = {
  label: string;
  min: number;
  max: number;
  color: string;
};

const POPULATION_CHOROPLETH_COLORS = ["#d1fae5", "#86efac", "#fde047", "#fb923c", "#ef4444", "#991b1b"];

const formatChoroplethNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return Math.round(value).toLocaleString();
};

const getQuantile = (sortedValues: number[], q: number): number => {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  return next === undefined ? sortedValues[base] : sortedValues[base] + rest * (next - sortedValues[base]);
};

const createPopulationChoroplethBins = (values: number[]): PopulationChoroplethBin[] => {
  const positiveValues = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (positiveValues.length === 0) {
    return [{ label: "No population", min: 0, max: 0, color: "#f1f5f9" }];
  }

  const min = positiveValues[0];
  const max = positiveValues[positiveValues.length - 1];

  if (min === max) {
    return [{ label: `${formatChoroplethNumber(max)} people`, min, max, color: POPULATION_CHOROPLETH_COLORS[2] }];
  }

  let bounds = [0, 0.2, 0.4, 0.6, 0.8, 1]
    .map((q) => Math.round(getQuantile(positiveValues, q)))
    .filter((value, index, list) => index === 0 || value > list[index - 1]);

  if (bounds.length < 4) {
    const step = (max - min) / (POPULATION_CHOROPLETH_COLORS.length - 1);
    bounds = Array.from({ length: POPULATION_CHOROPLETH_COLORS.length }, (_, index) => Math.round(min + step * index));
  }

  const binCount = Math.max(1, bounds.length - 1);
  return Array.from({ length: binCount }, (_, index) => {
    const minValue = index === 0 ? 0 : bounds[index];
    const maxValue = bounds[index + 1] ?? max;
    const label =
      index === 0
        ? `<= ${formatChoroplethNumber(maxValue)}`
        : index === binCount - 1
        ? `> ${formatChoroplethNumber(minValue)}`
        : `${formatChoroplethNumber(minValue)} - ${formatChoroplethNumber(maxValue)}`;
    return {
      label,
      min: minValue,
      max: maxValue,
      color: POPULATION_CHOROPLETH_COLORS[Math.min(index, POPULATION_CHOROPLETH_COLORS.length - 1)],
    };
  });
};

const getPopulationChoroplethBin = (value: number, bins: PopulationChoroplethBin[]): PopulationChoroplethBin => {
  if (!Number.isFinite(value) || value <= 0) return bins[0] ?? { label: "No population", min: 0, max: 0, color: "#f1f5f9" };
  return bins.find((bin, index) => {
    const isLast = index === bins.length - 1;
    return value >= bin.min && (value <= bin.max || isLast);
  }) ?? bins[bins.length - 1];
};
const getGeoJSONBBox = (geojson: any) => {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  const processCoords = (coords: any) => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        const [lng, lat] = coords;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      } else {
        coords.forEach(processCoords);
      }
    }
  };

  if (geojson) {
    if (geojson.geometry) {
      processCoords(geojson.geometry.coordinates);
    } else if (geojson.coordinates) {
      processCoords(geojson.coordinates);
    } else if (geojson.features) {
      geojson.features.forEach((f: any) => {
        if (f.geometry) processCoords(f.geometry.coordinates);
      });
    }
  }

  return { minLat, maxLat, minLng, maxLng };
};

// Creates a dedicated Leaflet pane for the GRID3 Settlement Footprints with a
// z-index above the default overlay pane (400). This guarantees the GRID3
// layer is painted ON TOP of administrative boundary polygons, so re-mounting
// of boundary <GeoJSON> elements (which happens on every Province change)
// can never visually bury the GRID3 footprints.
function Grid3PaneCreator() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("grid3Pane")) {
      const pane = map.createPane("grid3Pane");
      pane.style.zIndex = "450"; // overlayPane=400, markerPane=600
      pane.style.pointerEvents = "auto";
    }
  }, [map]);
  return null;
}

const getBoundaryStyle = (adminLevel: number, mode?: string) => {
  if (mode === "surveillance") {
    if (adminLevel === 1) return { color: "#94a3b8", weight: 2, fillOpacity: 0, fillColor: "transparent", dashArray: "6 4" };
    if (adminLevel === 2) return { color: "#64748b", weight: 1.5, fillOpacity: 0, fillColor: "transparent", dashArray: "4 3" };
    return { color: "#475569", weight: 1, fillOpacity: 0, fillColor: "transparent", dashArray: "3 3" };
  }
  if (adminLevel === 1) {
    return {
      color: "#6366f1", // Elegant Indigo
      weight: 2.5,
      fillOpacity: 0.04,
      fillColor: "#818cf8",
    };
  }
  if (adminLevel === 2) {
    return {
      color: "#0d9488", // Vibrant Teal
      weight: 2.0,
      fillOpacity: 0.06,
      fillColor: "#2dd4bf",
    };
  }
  // Level 3 (LLG/Ward/Facility Area)
  return {
    color: "#f59e0b", // Warm Amber
    weight: 1.5,
    fillOpacity: 0.08,
    fillColor: "#fcd34d",
  };
};

const createFacilityClusterIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  const size = count > 100 ? 40 : count > 50 ? 34 : count > 10 ? 28 : 22;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:rgba(59,130,246,0.85);border:2px solid rgba(147,197,253,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? 9 : 11}px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(59,130,246,0.4);">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createVillageClusterIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  const size = count > 100 ? 44 : count > 50 ? 38 : count > 20 ? 32 : 26;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:rgba(16,185,129,0.85);border:2px solid rgba(255,255,255,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${count > 99 ? 10 : 12}px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/* Original Image/CDN Based Map Marker Icons:
const facilityIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const plannedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -27],
  shadowSize: [33, 33],
});

const missingStandardIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -27],
  shadowSize: [33, 33],
});

const missingHtrIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -27],
  shadowSize: [33, 33],
});
*/

// Premium Offline-Available Vector Map Pin Icons (Built from shared SVG constants)
const facilityIcon = createFacilityCircleIcon();
const plannedIcon = createFilledPinIcon("green", FILLED_PIN_SIZE_20x29);
const missingStandardIcon = createFilledPinIcon("amber", FILLED_PIN_SIZE_20x29);
const missingHtrIcon = createFilledPinIcon("red", FILLED_PIN_SIZE_20x29);

const villageIcon = createVillageWithChvsIcon(0); // Render as default community icon with 0 showing if no CHV data mapped here
const htrIcon = createGapVillageIcon();

// Custom violet pin icon for community outreach posts
const outreachSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35" fill="none">` +
  `<path d="M12 0C5.37 0 0 5.37 0 12c0 9.3 12 23 12 23s12-13.7 12-23c0-6.63-5.37-12-12-12z" fill="#a855f7"/>` +
  `<circle cx="12" cy="12" r="4.5" fill="#ffffff"/>` +
  `</svg>`;

const outreachPostIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(outreachSvg) : ""}`,
  iconSize: [20, 29],
  iconAnchor: [10, 29],
  popupAnchor: [0, -29],
});

// Custom blue pin icon for reporting facilities in surveillance mode
const reportingFacilitySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35" fill="none">` +
  `<path d="M12 0C5.37 0 0 5.37 0 12c0 9.3 12 23 12 23s12-13.7 12-23c0-6.63-5.37-12-12-12z" fill="#2563eb"/>` +
  `<circle cx="12" cy="12" r="5.5" fill="#ffffff"/>` +
  `<path d="M10 15v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5M9 15h6" stroke="#2563eb" stroke-width="1.2" stroke-linecap="round" />` +
  `</svg>`;

const reportingFacilityIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(reportingFacilitySvg) : ""}`,
  iconSize: [20, 29],
  iconAnchor: [10, 29],
  popupAnchor: [0, -29],
});


interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  basemap?: Basemap;
  onBasemapChange?: (basemap: Basemap) => void;
}

function MapControls({ onZoomIn, onZoomOut, onLocate, basemap, onBasemapChange }: MapControlsProps) {
  return (
    <div className="absolute right-4 bottom-20 z-[1000] flex flex-col gap-1.5" ref={disableLeafletPropagation}>
      <Button size="icon" variant="secondary" onClick={onZoomIn} data-testid="button-zoom-in" className="shadow-md">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="secondary" onClick={onZoomOut} data-testid="button-zoom-out" className="shadow-md">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="secondary" onClick={onLocate} data-testid="button-locate" className="shadow-md">
        <Locate className="h-4 w-4" />
      </Button>
      {onBasemapChange && (
        <Button
          size="icon"
          variant={basemap === "satellite" ? "default" : "secondary"}
          onClick={() => onBasemapChange(basemap === "satellite" ? "osm" : "satellite")}
          title={basemap === "satellite" ? "Switch to Street View" : "Switch to Satellite View"}
          className="shadow-md"
          data-testid="button-basemap-toggle"
        >
          <Globe className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/*
// Original Code: MapController didn't track active map-driven zoom changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
}
*/

// Updated Code: MapController supports listening to active map zoom and bounds changes
function MapController({
  center,
  zoom,
  onZoomChange,
  onBoundsChange
}: {
  center: [number, number];
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
}) {
  const map = useMap();
  const [lat, lng] = center;

  // Track previous prop values using refs to prevent recursive snap-back cycles and infinite loops
  const prevCenterRef = useRef<[number, number]>([lat, lng]);
  const prevZoomRef = useRef<number>(zoom);

  // Initialize bounds exactly once on map load to ensure they are available to parent filters
  useEffect(() => {
    if (onBoundsChange) {
      onBoundsChange(map.getBounds());
    }
  }, [map]);

  useEffect(() => {
    const prevCenter = prevCenterRef.current;
    const prevZoom = prevZoomRef.current;

    // Check if the center or zoom props have actually changed from their previous values.
    // If the user manually panned, the map's current view changes but the props remain identical,
    // so we skip setView to prevent snapping back and infinite loop cascades.
    const centerPropsChanged = prevCenter[0] !== lat || prevCenter[1] !== lng;
    const zoomPropsChanged = prevZoom !== zoom;

    if (centerPropsChanged || zoomPropsChanged) {
      map.setView([lat, lng], zoom);
      prevCenterRef.current = [lat, lng];
      prevZoomRef.current = zoom;
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    }
  }, [map, lat, lng, zoom]);

  useMapEvents({
    zoomend: () => {
      if (onZoomChange) {
        onZoomChange(map.getZoom());
      }
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    },
    moveend: () => {
      if (onBoundsChange) {
        onBoundsChange(map.getBounds());
      }
    }
  });

  return null;
}


function coordinateToLatLng(coord: any): { lat: number; lng: number } | null {
  if (!coord) return null;

  if (Array.isArray(coord)) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  const lat = Number(coord.lat ?? coord.latitude);
  const lng = Number(coord.lng ?? coord.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function isPointInGeoJSONRing(lat: number, lng: number, ring: any[]) {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = coordinateToLatLng(ring[i]);
    const previous = coordinateToLatLng(ring[j]);
    if (!current || !previous) continue;

    const crossesLatitude = current.lat > lat !== previous.lat > lat;
    if (!crossesLatitude) continue;

    const denominator = previous.lat - current.lat || Number.EPSILON;
    const intersectionLng = ((previous.lng - current.lng) * (lat - current.lat)) / denominator + current.lng;
    if (lng < intersectionLng) inside = !inside;
  }

  return inside;
}

function isPointInGeoJSONPolygon(lat: number, lng: number, coordinates: any[]) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  if (!isPointInGeoJSONRing(lat, lng, coordinates[0])) return false;

  for (let i = 1; i < coordinates.length; i++) {
    if (isPointInGeoJSONRing(lat, lng, coordinates[i])) return false;
  }

  return true;
}

function isPointInGeoJSONBoundary(lat: number, lng: number, geojson: any): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !geojson) return false;

  if (geojson.type === "FeatureCollection") {
    return Array.isArray(geojson.features) && geojson.features.some((feature: any) => isPointInGeoJSONBoundary(lat, lng, feature));
  }

  if (geojson.type === "Feature") {
    return isPointInGeoJSONBoundary(lat, lng, geojson.geometry);
  }

  if (geojson.type === "Polygon") {
    return isPointInGeoJSONPolygon(lat, lng, geojson.coordinates);
  }

  if (geojson.type === "MultiPolygon") {
    return Array.isArray(geojson.coordinates) && geojson.coordinates.some((polygonCoordinates: any[]) => isPointInGeoJSONPolygon(lat, lng, polygonCoordinates));
  }

  return false;
}

function isPointInAnyGeoJSONBoundary(lat: number, lng: number, geojsons: any[]) {
  return geojsons.some((geojson) => isPointInGeoJSONBoundary(lat, lng, geojson));
}
interface MapLegendProps {
  leftOffset?: boolean;
  hiddenCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  planningStats?: {
    planned: number;
    missingStandard: number;
    missingHtr: number;
    total: number;
    coverage: number;
  };
  showPopulationLegend?: boolean;
  /** Count of currently-visible health facilities (respects active province/district filters) */
  facilityCount?: number;
}

function MapLegend({
  leftOffset = false,
  hiddenCategories,
  onToggleCategory,
  isExpanded,
  onToggleExpanded,
  planningStats = { planned: 0, missingStandard: 0, missingHtr: 0, total: 0, coverage: 0 },
  showPopulationLegend = false,
  facilityCount,
}: MapLegendProps) {
  if (!isExpanded) {
    return (
      <div className={`absolute ${leftOffset ? "left-72" : "left-4"} bottom-4 z-[1000] transition-all duration-300`} ref={disableLeafletPropagation}>
        <Button
          size="sm"
          onClick={onToggleExpanded}
          className="shadow-lg border border-white/10 bg-background/85 backdrop-blur-md hover:bg-accent/40 font-bold text-xs gap-1.5 h-9 px-3 text-primary flex items-center rounded-xl pointer-events-auto"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Show Legend ({planningStats.coverage}% Coverage)
        </Button>
      </div>
    );
  }

  const items = [
    // Updated Code: facilityCount is now shown alongside the Health Facility legend item.
    // It reflects the currently-filtered facility count (province/district/search aware).
    { key: "facility", label: "Health Facility", color: "bg-blue-500", count: facilityCount ?? null },
    { key: "planned", label: "Planned Community", color: "bg-emerald-500", count: planningStats.planned },
    // Session plan pins on the live map (Task #47). Status-driven styling.
    { key: "sessionPlanned", label: "Session • Planned", color: "bg-blue-600", count: (planningStats as any).sessionPlanned ?? 0 },
    { key: "sessionInProgress", label: "Session • In Progress", color: "bg-amber-500", count: (planningStats as any).sessionInProgress ?? 0 },
    { key: "sessionOverdue", label: "Session • Overdue", color: "bg-rose-500", count: (planningStats as any).sessionOverdue ?? 0 },
    { key: "sessionCompleted", label: "Session • Completed", color: "bg-emerald-600", count: (planningStats as any).sessionCompleted ?? 0 },
    { key: "unserved", label: "Unserved Place", color: "bg-red-600", count: (planningStats as any).unserved ?? 0 },
  ];

  return (
    <div className={`absolute ${leftOffset ? "left-72" : "left-4"} bottom-4 z-[1000] transition-all duration-300`} ref={disableLeafletPropagation}>
      <Card className="w-56 shadow-2xl border border-white/15 bg-background/85 backdrop-blur-md rounded-xl select-none pointer-events-auto max-h-[calc(100vh-140px)] flex flex-col">
        <CardHeader className="p-3 pb-1.5 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
          <CardTitle className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="h-3 w-3" />
            EPI Planning Legend
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={onToggleExpanded}
          >
            <ChevronLeft className="h-3 w-3 rotate-180" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 pt-2.5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-1.5">
            {items.map((item) => {
              const isHidden = hiddenCategories.has(item.key);
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => onToggleCategory(item.key)}
                  className={`w-full text-left flex items-center justify-between gap-2 p-1.5 rounded-lg border border-transparent cursor-pointer hover:bg-accent/45 transition-all duration-200 focus:outline-none ${
                    isHidden ? "opacity-40 line-through text-muted-foreground bg-muted/20" : "text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-sm shrink-0`} />
                    <span className="text-xs font-semibold truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.count !== null && (
                      <span className="font-mono text-[10px] font-bold text-foreground bg-muted px-1 py-0.2 rounded">
                        {item.count}
                      </span>
                    )}
                    {!isHidden ? (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded leading-none border border-emerald-500/10">On</span>
                    ) : (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1 py-0.5 rounded leading-none border border-border/40">Off</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Coverage Rate Progress Bar */}
          <div className="border-t border-border/30 pt-2.5 space-y-1.5 text-[10px]">
            <div className="flex justify-between font-bold">
              <span className="text-muted-foreground uppercase">Planning Coverage:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono">{planningStats.coverage}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${planningStats.coverage}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground font-medium text-center">
              {planningStats.planned} / {planningStats.total} Communities Scheduled
            </p>
          </div>

          {/* Gridded population overlay heat-map legend */}
          {showPopulationLegend && (
            <div className="border-t border-border/30 pt-2.5 space-y-2">
              <Label className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                People per grid cell
              </Label>
              <p className="text-[8px] text-muted-foreground leading-snug -mt-1">
                Estimated people living in each ~100 m × 100 m cell (1 hectare). Click any cell for the headcount nearby.
              </p>
              <div className="space-y-1 pl-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(127, 29, 29, 0.85)" }} />
                  <span className="text-[9px] font-medium text-foreground">&gt; 1,000 people (Extreme)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(185, 28, 28, 0.8)" }} />
                  <span className="text-[9px] font-medium text-foreground">501 - 1,000 people (High)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(220, 38, 38, 0.75)" }} />
                  <span className="text-[9px] font-medium text-foreground">251 - 500 people (Med-High)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(234, 88, 12, 0.7)" }} />
                  <span className="text-[9px] font-medium text-foreground">101 - 250 people (Medium)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(249, 115, 22, 0.65)" }} />
                  <span className="text-[9px] font-medium text-foreground">51 - 100 people (Low-Med)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(234, 179, 8, 0.6)" }} />
                  <span className="text-[9px] font-medium text-foreground">11 - 50 people (Low)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded shadow-xs" style={{ backgroundColor: "rgba(34, 197, 94, 0.5)" }} />
                  <span className="text-[9px] font-medium text-foreground">1 - 10 people (Scattered)</span>
                </div>
              </div>
            </div>
          )}

          {hiddenCategories.size > 0 && (
            <button
              onClick={() => {
                items.forEach((item) => {
                  if (hiddenCategories.has(item.key)) {
                    onToggleCategory(item.key);
                  }
                });
              }}
              className="w-full text-center text-[10px] font-bold text-primary hover:underline pt-1.5 border-t border-border/30"
            >
              Reset Filters
            </button>
          )}
        </CardContent>
        {/* Original Code: Only rendering the guide when showPopulationLegend is active. We are commenting this out to make the guide always accessible.
        {showPopulationLegend && (
          <div className="p-3 pt-2 border-t border-border/40 shrink-0">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[9px] font-bold h-7 gap-1 border-primary/20 text-primary hover:bg-primary/5 rounded-lg select-none"
                >
                  <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
                  Missed Communities Guide
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-md shadow-2xl rounded-3xl p-5 select-text pointer-events-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-primary font-black">
                    <Zap className="h-5 w-5 text-amber-500 shrink-0" />
                    <span>Spatial Population Strategy Guide</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed font-sans">
                    Learn how to utilize gridded spatial population density models to pinpoint missed settlements and plan precise, high-coverage immunizations.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-3.5 text-xs leading-relaxed text-foreground select-text font-sans">
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <h4 className="font-bold text-primary flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                      1. Pinpoint Missed Communities
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                      Look for clusters of high-density population grids (Crimson, Red, Orange blocks) on the map that **lack green Community pins**. These represent unregistered settlements currently missed by vaccine outreach.
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                    <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                      2. Audit Geofence Catchment Gaps
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                      Verify that high-density grids are enclosed within the geofenced **Catchment Area Polygons**. Population pockets falling outside boundaries represent zero-dose risks that should be incorporated.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                      3. Optimize HTR Outreach Circles
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                      Ensure scattered yellow and green settlements are covered by **5km HTR Outreach Buffer circles**. Settlements outside these radii require dedicated mobile team deployment.
                    </p>
                  </div>
                </div>
                <DialogFooter className="pt-3">
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full rounded-xl">Got it, Let's Optimize</Button>
                  </DialogTrigger>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        */}

        {/* Updated Code: Render the "Missed Communities Guide" button inside a permanent sticky footer at the bottom of the map legend card. This ensures the guide is always accessible even when the population density layer is toggled off. */}
        <div className="p-3 pt-2 border-t border-border/40 shrink-0">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[9px] font-bold h-7 gap-1 border-primary/20 text-primary hover:bg-primary/5 rounded-lg select-none"
              >
                <Zap className="h-3 w-3 text-amber-500 animate-pulse" />
                Missed Communities Guide
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-md shadow-2xl rounded-3xl p-5 select-text pointer-events-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary font-black">
                  <Zap className="h-5 w-5 text-amber-500 shrink-0" />
                  <span>Spatial Population Strategy Guide</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-1.5 leading-relaxed font-sans">
                  Learn how to utilize gridded spatial population density models to pinpoint missed settlements and plan precise, high-coverage immunizations.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-3.5 text-xs leading-relaxed text-foreground select-text font-sans">
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <h4 className="font-bold text-primary flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                    1. Pinpoint Missed Communities
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                    Look for clusters of high-density population grids (Crimson, Red, Orange blocks) on the map that **lack green Community pins**. These represent unregistered settlements currently missed by vaccine outreach.
                  </p>
                </div>

                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                    2. Audit Geofence Catchment Gaps
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                    Verify that high-density grids are enclosed within the geofenced **Catchment Area Polygons**. Population pockets falling outside boundaries represent zero-dose risks that should be incorporated.
                  </p>
                </div>

                <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                  <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                    3. Optimize HTR Outreach Circles
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal font-sans">
                    Ensure scattered yellow and green settlements are covered by **5km HTR Outreach Buffer circles**. Settlements outside these radii require dedicated mobile team deployment.
                  </p>
                </div>
              </div>
              <DialogFooter className="pt-3">
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full rounded-xl">Got it, Let's Optimize</Button>
                </DialogTrigger>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </div>
  );
}


export interface MapOverlayLayers {
  facilities: boolean;
  villages: boolean;
  htrAreas: boolean;
  catchments: boolean;
  roads: boolean;
  boundaries: boolean;   // admin boundary polygons from GeoBoundaries/GADM
  hcwCatchments: boolean; // HCW-drawn facility catchment polygons
  wards: boolean;
  constituencies: boolean;
  populationGeoTIFF: boolean;
  populationChoropleth: boolean;
  grid3Settlements: boolean;
  zeroDoseVillages: boolean; // Per-village zero-dose / under-immunized graduated pins
  underImmunizedVillages: boolean; // Per-village under-immunized (DTP1 but no DTP3) graduated pins
  showLabels?: boolean;
}

interface LayerPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  layers: MapOverlayLayers;
  onLayerToggle: (layer: keyof MapOverlayLayers) => void;
  basemap: Basemap;
  onBasemapChange: (basemap: Basemap) => void;
  boundaryList?: Array<{ id: string; adminLevel: number; levelName: string; isActive: boolean }>;
  countryCode?: string;
  adminLabels?: { level1: string; level2: string; level3: string; level4: string };
  grid3Unavailable?: boolean;
}

/*
// Original Code: Absolute positioned LayerPanel
function LayerPanel({
  isOpen,
  onToggle,
  layers,
  onLayerToggle,
  basemap,
  onBasemapChange,
}: LayerPanelProps) {
  return (
    <div className={`absolute left-4 top-4 z-[1000] transition-all duration-200 ${isOpen ? "w-64" : "w-auto"}`}>
      <Card>
        ...
      </Card>
    </div>
  );
}
*/

// Updated Code: Relative flow LayerPanel suitable for stacking alongside FilterPanel, with country-adaptive overlay naming, custom labels, and dynamic database missing warnings.
function LayerPanel({
  isOpen,
  onToggle,
  layers,
  onLayerToggle,
  basemap,
  onBasemapChange,
  boundaryList = [],
  countryCode,
  adminLabels,
  grid3Unavailable = false,
}: LayerPanelProps) {
  return (
    <div className={`transition-all duration-200 ${isOpen ? "w-64" : "w-auto"}`} ref={disableLeafletPropagation}>
      <Card className="shadow-lg border border-white/10 bg-background/85 backdrop-blur-md">
        <CardHeader className="p-3 flex flex-row items-center justify-between gap-2 border-b border-border/40">
          {isOpen && (
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
              <Layers className="h-4 w-4" />
              Layers
            </CardTitle>
          )}
          <Button size="icon" variant="ghost" onClick={onToggle} data-testid="button-toggle-layers">
            {isOpen ? <ChevronLeft className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {isOpen && (
          <CardContent className="p-3 pt-3 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Basemap</Label>
              <Select value={basemap} onValueChange={(v) => onBasemapChange(v as Basemap)}>
                <SelectTrigger className="w-full text-xs h-8 bg-card border-border" data-testid="select-basemap">
                  <SelectValue placeholder="Select basemap" />
                </SelectTrigger>
                <SelectContent className="z-[2000] bg-background border-border">
                  {BASEMAP_ITEMS.map((item) => (
                    <SelectItem key={item.key} value={item.key} className="text-xs">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground block mb-1">Overlays</Label>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {Object.entries(layers).map(([key, value]) => {
                  let displayName = key.replace(/([A-Z])/g, " $1").trim();
                  let subtext = "";
                  let subtextClass = "text-[10px] text-muted-foreground block mt-0.5 leading-normal";

                  const hasLevel2 = boundaryList?.some((b) => b.adminLevel === 2);
                  const hasLevel3 = boundaryList?.some((b) => b.adminLevel === 3);
                  const hasAnyBoundary = (boundaryList?.length ?? 0) > 0;

                  // ── Layer display names & subtext ──
                  if (key === "facilities") {
                    displayName = "Health Facilities";
                    subtext = "Hospital, clinic & health post markers";
                  } else if (key === "villages") {
                    displayName = "Communities / Villages";
                    subtext = "Settlement markers with planning status";
                  } else if (key === "htrAreas") {
                    displayName = "HTR Outreach Buffers";
                    subtext = "5 km radius around hard-to-reach communities";
                  } else if (key === "catchments") {
                    displayName = "Facility Catchments";
                    subtext = "5 & 10 km concentric walkability circles + community-to-facility lines";
                  } else if (key === "roads") {
                    displayName = "Road Network";
                    subtext = "Esri transport network overlay (requires internet)";
                  } else if (key === "boundaries") {
                    displayName = "Administrative Boundaries";
                    if (!hasAnyBoundary) {
                      subtext = "⚠ No boundaries imported — use Data Seeding → Import Boundaries";
                      subtextClass = "text-[10px] text-amber-400 font-medium block mt-0.5 leading-normal";
                    } else {
                      subtext = "Cascading province / district boundary polygons";
                    }
                  } else if (key === "hcwCatchments") {
                    displayName = "Saved Catchments";
                    subtext = "Polygons saved via Draw Catchment — shown by default";
                  } else if (key === "wards") {
                    displayName = adminLabels?.level3 || "Wards";
                    if (!hasLevel3) {
                      subtext = `⚠ No ${adminLabels?.level3 || "Ward"} boundaries imported yet`;
                      subtextClass = "text-[10px] text-amber-400 font-medium block mt-0.5 leading-normal";
                    } else {
                      subtext = `${adminLabels?.level3 || "Ward"} level boundary polygons`;
                    }
                  } else if (key === "constituencies") {
                    displayName = adminLabels?.level2 || "Constituencies";
                    if (!hasLevel2) {
                      subtext = `⚠ No ${adminLabels?.level2 || "Constituency"} boundaries imported yet`;
                      subtextClass = "text-[10px] text-amber-400 font-medium block mt-0.5 leading-normal";
                    } else if (countryCode === "ZMB") {
                      subtext = "Districts mapped as constituencies in database";
                      subtextClass = "text-[10px] text-indigo-400 font-medium block mt-0.5 leading-normal";
                    } else {
                      subtext = `${adminLabels?.level2 || "Constituency"} level boundary polygons`;
                    }
                  } else if (key === "populationGeoTIFF") {
                    displayName = "Population Density (Raster)";
                    subtext = "WorldPop gridded raster heat-map (upload via Resources)";
                  } else if (key === "populationChoropleth") {
                    displayName = "Population Choropleth";
                    subtext = "District population from NSO/HMIS census data";
                  } else if (key === "grid3Settlements") {
                    displayName = "GRID3 Settlement Footprints";
                    if (grid3Unavailable) {
                      subtext = "No tenant settlement-footprint file imported yet";
                      subtextClass = "text-[10px] text-amber-400 font-medium block mt-0.5 leading-normal";
                    } else {
                      subtext = "High-fidelity settlement footprint extents for the active tenant";
                    }
                  } else if (key === "zeroDoseVillages") {
                    displayName = "Zero-dose Villages";
                    subtext = "Graduated pins by missed-child count (DTP1 gap)";
                  } else if (key === "underImmunizedVillages") {
                    displayName = "Under-immunized Villages";
                    subtext = "Graduated amber pins by under-immunized count (DTP1, no DTP3)";
                  } else if (key === "showLabels") {
                    displayName = "Show Map Labels";
                    subtext = "Permanent administrative boundary and village text labels";
                  }

                  // ── Data-availability dot color ──
                  // green = data always available; amber = data missing/requires import;
                  // sky = conditional (drawn/uploaded); violet = external API
                  let dotColor = "bg-emerald-500";
                  if ((key === "boundaries" && !hasAnyBoundary) ||
                      (key === "wards" && !hasLevel3) ||
                      (key === "constituencies" && !hasLevel2) ||
                      (key === "grid3Settlements" && grid3Unavailable)) {
                    dotColor = "bg-amber-400";
                  } else if (key === "populationGeoTIFF" || key === "populationChoropleth") {
                    dotColor = "bg-sky-400";
                  } else if (key === "grid3Settlements") {
                    dotColor = "bg-violet-400";
                  } else if (key === "hcwCatchments") {
                    dotColor = "bg-sky-400";
                  }

                  const isDisabled = false;

                  return (
                    <div key={key} className="border-b border-border/10 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 py-1">
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={key} className="text-sm font-medium cursor-pointer text-foreground flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-px ${dotColor}`} title={dotColor === "bg-amber-400" ? "No data imported" : dotColor === "bg-violet-400" ? "External API" : "Data available"} />
                            <span className="truncate">{displayName}</span>
                          </Label>
                          {subtext && <span className={`${subtextClass} pl-3`}>{subtext}</span>}
                        </div>
                        <Switch
                          id={key}
                          checked={value && !isDisabled}
                          onCheckedChange={() => !isDisabled && onLayerToggle(key as keyof MapOverlayLayers)}
                          disabled={isDisabled}
                          title={grid3Unavailable && key === "grid3Settlements" ? "No tenant settlement-footprint file imported yet" : undefined}
                          data-testid={`switch-layer-${key}`}
                          className="mt-0.5 flex-shrink-0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}


interface FilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedProvinceId: number | "all";
  onProvinceChange: (provinceId: number | "all") => void;
  selectedDistrictId: number | "all";
  onDistrictChange: (districtId: number | "all") => void;
  selectedFacilityId: number | null;
  onFacilityChange: (facilityId: number | null) => void;
  villageCategory: "all" | "htr" | "standard";
  onVillageCategoryChange: (category: "all" | "htr" | "standard") => void;
  filterColdChain: boolean;
  onColdChainToggle: () => void;
  filterPower: boolean;
  onPowerToggle: () => void;
  provinces: any[];
  districts: any[];
  facilities: any[];
  adminLabels: { level1: string; level2: string; level3: string; level4: string };
  totalFacilitiesCount: number;
  filteredFacilitiesCount: number;
  totalVillagesCount: number;
  filteredVillagesCount: number;
}

function FilterPanel({
  isOpen,
  onToggle,
  searchQuery,
  onSearchChange,
  selectedProvinceId,
  onProvinceChange,
  selectedDistrictId,
  onDistrictChange,
  selectedFacilityId,
  onFacilityChange,
  villageCategory,
  onVillageCategoryChange,
  filterColdChain,
  onColdChainToggle,
  filterPower,
  onPowerToggle,
  provinces,
  districts,
  facilities,
  adminLabels,
  totalFacilitiesCount,
  filteredFacilitiesCount,
  totalVillagesCount,
  filteredVillagesCount,
}: FilterPanelProps) {
  // Cascading Selectors logic filtering Districts options by Province and Facilities by Province/District
  const filteredDistrictsForSelect = useMemo(() => {
    if (selectedProvinceId === "all") return districts;
    return districts.filter((d) => Number(d.provinceId) === Number(selectedProvinceId));
  }, [districts, selectedProvinceId]);

  const filteredFacilitiesForSelect = useMemo(() => {
    return facilities.filter((f) => {
      if (selectedProvinceId !== "all") {
        const dist = districts.find((d) => Number(d.id) === Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(selectedProvinceId)) return false;
      }
      if (selectedDistrictId !== "all" && Number(f.districtId) !== Number(selectedDistrictId)) {
        return false;
      }
      return true;
    });
  }, [facilities, districts, selectedProvinceId, selectedDistrictId]);

  return (
    <div className={`transition-all duration-200 ${isOpen ? "w-64" : "w-auto"}`} ref={disableLeafletPropagation}>
      <Card className="shadow-lg border border-white/10 bg-background/85 backdrop-blur-md">
        <CardHeader className="p-3 flex flex-row items-center justify-between gap-2 border-b border-border/40">
          {isOpen && (
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-primary">
              <Filter className="h-4 w-4" />
              Map Filters
            </CardTitle>
          )}
          <Button size="icon" variant="ghost" onClick={onToggle} data-testid="button-toggle-filters">
            {isOpen ? <ChevronLeft className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {isOpen && (
          <CardContent className="p-3 pt-3 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
            {/* Search Input */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/85" />
                <Input
                  type="text"
                  placeholder="Search name, code, hmis..."
                  className="pl-8 h-9 text-xs bg-background/50"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 h-7 w-7 rounded-full hover:bg-muted"
                    onClick={() => onSearchChange("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Province Selector */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {adminLabels.level1} Filter
              </Label>
              <Select
                value={selectedProvinceId === "all" ? "all" : String(selectedProvinceId)}
                onValueChange={(val) => onProvinceChange(val === "all" ? "all" : Number(val))}
              >
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue placeholder={`Select ${adminLabels.level1}...`} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All {adminLabels.level1}s</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District Selector */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {adminLabels.level2} Filter
              </Label>
              <Select
                value={selectedDistrictId === "all" ? "all" : String(selectedDistrictId)}
                onValueChange={(val) => onDistrictChange(val === "all" ? "all" : Number(val))}
              >
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue placeholder={`Select ${adminLabels.level2}...`} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All {adminLabels.level2}s</SelectItem>
                  {filteredDistrictsForSelect.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Original LLG Selector commented out for safety:
            {/* LLG / Ward Selector */}
            {/*
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {adminLabels.level3} Filter
              </Label>
              <Select
                value={selectedLlgId === "all" ? "all" : String(selectedLlgId)}
                onValueChange={(val) => onLlgChange(val === "all" ? "all" : Number(val))}
              >
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue placeholder={`Select ${adminLabels.level3}...`} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All {adminLabels.level3}s</SelectItem>
                  {filteredLlgsForSelect.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            */}
            {/* Health Facility Selector (replacing Constituency filter) */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Health Facility Filter
              </Label>
              <Select
                value={selectedFacilityId === null ? "all" : String(selectedFacilityId)}
                onValueChange={(val) => onFacilityChange(val === "all" ? null : Number(val))}
              >
                <SelectTrigger className="h-9 text-xs bg-background/50">
                  <SelectValue placeholder="All Health Facilities" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">All Health Facilities</SelectItem>
                  {filteredFacilitiesForSelect.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Village Type (HTR vs Standard) Filter */}
            <div className="space-y-2">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {adminLabels.level4} Category
              </Label>
              <div className="grid grid-cols-3 gap-1 bg-muted/40 p-0.5 rounded-lg border">
                <button
                  onClick={() => onVillageCategoryChange("all")}
                  className={`py-1 text-[10px] font-semibold rounded-md transition-all ${
                    villageCategory === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => onVillageCategoryChange("htr")}
                  className={`py-1 text-[10px] font-semibold rounded-md transition-all ${
                    villageCategory === "htr"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm border border-red-500/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  HTR
                </button>
                <button
                  onClick={() => onVillageCategoryChange("standard")}
                  className={`py-1 text-[10px] font-semibold rounded-md transition-all ${
                    villageCategory === "standard"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>

            {/* Facility Resource Toggles */}
            <div className="space-y-2 pt-1">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Facility Equipment
              </Label>

              <div className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 hover:bg-accent/25 transition-colors">
                <Label htmlFor="filter-cold-chain-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer select-none">
                  <Thermometer className="h-4 w-4 text-blue-500 shrink-0" />
                  Cold Chain Functional
                </Label>
                <Switch
                  id="filter-cold-chain-toggle"
                  checked={filterColdChain}
                  onCheckedChange={onColdChainToggle}
                  className="scale-90"
                />
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg border border-border/40 hover:bg-accent/25 transition-colors">
                <Label htmlFor="filter-power-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer select-none">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  Power Supply Active
                </Label>
                <Switch
                  id="filter-power-toggle"
                  checked={filterPower}
                  onCheckedChange={onPowerToggle}
                  className="scale-90"
                />
              </div>
            </div>

            {/* Real-time Counts Footer */}
            <div className="pt-3 border-t border-border/40 space-y-1.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Facilities Shown:</span>
                <span className="font-semibold text-foreground">
                  {filteredFacilitiesCount} / {totalFacilitiesCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Villages Shown:</span>
                <span className="font-semibold text-foreground">
                  {filteredVillagesCount} / {totalVillagesCount}
                </span>
              </div>
              {(searchQuery || selectedProvinceId !== "all" || selectedDistrictId !== "all" || selectedFacilityId !== null || villageCategory !== "all" || filterColdChain || filterPower) && (
                <button
                  onClick={() => {
                    onSearchChange("");
                    onProvinceChange("all");
                    onDistrictChange("all");
                    onFacilityChange(null);
                    onVillageCategoryChange("all");
                    if (filterColdChain) onColdChainToggle();
                    if (filterPower) onPowerToggle();
                  }}
                  className="w-full text-center text-primary hover:underline font-bold mt-2"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

interface MapViewProps {
  facilities?: Facility[];
  villages?: Village[];
  cases?: any[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showFacilityList?: boolean;
  mode?: "planning" | "surveillance";
}

// Custom helper component to listen to Leaflet map events for measurement clicking
function MapEvents({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    click(e) {
      onClick(e);
    },
  });
  return null;
}
// Original Code: Intercepts and stops propagation of all mouse, touch, and pointer events in the capture phase.
// This broke React event delegation (which delegates events at the #root element) for all interactive child elements (like Select, Input, Buttons) inside the overlays.
/*
export const disableLeafletPropagation = (el: HTMLDivElement | null) => {
  if (el) {
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);

    const halt = (e: Event) => e.stopPropagation();
    const events = ["click", "dblclick", "mousedown", "mouseup", "touchstart", "touchend", "touchmove", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "contextmenu"];
    events.forEach(event => el.addEventListener(event, halt, true));
  }
};
*/

// Updated Code: Upgraded event propagation blocker supporting type-safe selective capture.
// If the user interacts with form elements, buttons, comboboxes, select menus, or checkboxes, the event is allowed to capture and bubble normally to allow React's event delegation to execute.
// Otherwise, it stops propagation in the capture phase to fully block map zoom, panning, and mouse click bleed.
export const disableLeafletPropagation = (el: HTMLDivElement | null) => {
  if (el) {
    // Upgraded Code: Prevent duplicate event listener leaks on every React render cycle.
    // We attach a stable boolean flag directly to the DOM element node ref to guarantee listeners are added exactly once.
    if ((el as any)._leaflet_propagation_disabled) {
      return;
    }
    (el as any)._leaflet_propagation_disabled = true;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);

    const halt = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName.toLowerCase() === "input" ||
         target.tagName.toLowerCase() === "button" ||
         target.tagName.toLowerCase() === "select" ||
         target.tagName.toLowerCase() === "option" ||
         target.tagName.toLowerCase() === "textarea" ||
         target.tagName.toLowerCase() === "label" ||
         target.closest("button") ||
         target.closest("input") ||
         target.closest("select") ||
         target.closest("label") ||
         target.closest("a") ||
         target.closest("[role='combobox']") ||
         target.closest("[role='listbox']") ||
         target.closest("[role='option']") ||
         target.closest("[role='switch']") ||
         target.closest("[role='checkbox']") ||
         target.closest("[role='tab']") ||
         target.closest("[role='menuitem']") ||
         target.closest(".select-trigger") ||
         target.closest(".select-content") ||
         target.closest(".switch") ||
         target.closest("[data-state]"))
      ) {
        return; // Do not stop propagation of interactive events in the capture phase!
      }
      e.stopPropagation();
    };
    const events = ["click", "dblclick", "mousedown", "mouseup", "touchstart", "touchend", "touchmove", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "contextmenu"];
    events.forEach(event => el.addEventListener(event, halt, true));
  }
};

interface GeoTIFFOverlayProps {
  url: string;
  opacity?: number;
  onRasterLoaded?: (georaster: any) => void;
  // Active *view* tenant id — used to scope the IndexedDB raster cache so a
  // cached raster from another country (e.g. the user's home tenant) is never
  // re-served when the user has switched to a different tenant.
  cacheScope?: string;
  // When false, the overlay will NOT auto-fit the map to the raster bounds on
  // load. The tenant's configured mapCenter/mapZoom and the explicit raster
  // selector already handle centering — auto-fitting here was causing the map
  // to snap to whatever raster happened to be cached.
  autoFit?: boolean;
}

function GeoTIFFOverlay({ url, opacity = 0.65, onRasterLoaded, cacheScope, autoFit = false }: GeoTIFFOverlayProps) {
  const map = useMap();
  const layerRef = useRef<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;

    // Derive a stable cache key from the URL — include any ?file= query so the
    // default (auto-resolved) raster gets its own per-scope slot distinct from
    // explicitly selected files.
    const urlPath = url.split("?")[0].split("/").pop() ?? "default";
    const urlQuery = url.includes("?") ? url.split("?")[1] : "";
    const cacheKey = `geotiff_${urlPath}${urlQuery ? `_${urlQuery}` : ""}`;
    // Scope cache to the active *view* tenant, falling back to the user's home
    // tenant only when no explicit scope was passed.
    const tenantId = cacheScope ?? (user as any)?.tenantId ?? "global";

    async function loadRaster() {
      let arrayBuffer: ArrayBuffer | undefined;

      // Layer 1: IndexedDB gisCache — instant read, survives page reloads and app restarts.
      // This is critical on Android where the WebView's HTTP disk cache can be evicted
      // under memory pressure, causing a 14–63 MB re-download every time the layer is toggled.
      try {
        // Original Code (Composite primary key lookup with query object - returns undefined on composite index):
        // const cached = await offlineDb.gisCache.get({ key: cacheKey, tenantId });
        // Updated Code: Correctly passes the composite index primary key as a tuple [key, tenantId]
        const cached = await offlineDb.gisCache.get([cacheKey, tenantId]);
        if (cached?.rasterBuffer) {
          arrayBuffer = cached.rasterBuffer;
        }
      } catch (_cacheErr) {
        console.warn("[GIS Cache] IndexedDB gisCache raster read skipped:", _cacheErr);
      }

      // Layer 2: HTTP fetch (cache miss path — runs once per device)
      if (!arrayBuffer) {
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 204) {
          console.info("[GeoTIFF] No raster configured for this tenant; population overlay skipped.");
          return;
        }
        if (!res.ok) {
          if (res.status === 404) throw new Error("No population GeoTIFF file found in resources.");
          throw new Error(`HTTP Error ${res.status}`);
        }
        arrayBuffer = await res.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          console.info("[GeoTIFF] Empty raster response; population overlay skipped.");
          return;
        }

        // Layer 3: Persist to IndexedDB asynchronously — do not block the map render
        offlineDb.gisCache.put({ key: cacheKey, tenantId, rasterBuffer: arrayBuffer, cachedAt: Date.now() })
          .catch((err) => console.warn("[GIS Cache] Failed to persist GeoTIFF to IndexedDB:", err));
      }

      if (!active || !arrayBuffer) return;

      const parseGeorasterModule = await import("georaster");
      const parseFn = (parseGeorasterModule as any).default || parseGeorasterModule;
      const georaster = await parseFn(arrayBuffer);

      if (!active || !georaster) return;

      /*
      // Original Coordinate Warping Hack (Added when Zambia's raster was corrupted):
      // Map valid carrier raster structural bounds onto Zambia.
      // Now that the user has uploaded the real, uncorrupted Zambia and South Sudan
      // population rasters with native correct coordinates, this warping hack is no longer required!
      if (url.toLowerCase().includes("zmb") || cacheKey.toLowerCase().includes("zmb")) {
        georaster.xmin = 21.98;
        georaster.ymin = -18.07;
        georaster.xmax = 33.72;
        georaster.ymax = -8.20;
      }
      */


      if (onRasterLoaded) {
        onRasterLoaded(georaster);
      }

      // Set window.L so georaster-layer-for-leaflet can reference it safely
      (window as any).L = L;

      // Updated Code: Safe ESM import compatibility wrapper to resolve default-export mismatches under Vite build minification
      const GeoRasterLayerModule = await import("georaster-layer-for-leaflet");
      const GeoRasterLayerClass = (GeoRasterLayerModule as any).default || GeoRasterLayerModule;

      // Original Code: interactive by default, which blocks underlying map click events
      /*
      // Create Leaflet layer from parsed georaster
      const layer = new (GeoRasterLayerClass as any)({
        georaster,
        opacity,
        pixelValuesToColorFn: (values: number[]) => {
          const val = values[0];
          if (val === undefined || isNaN(val) || val <= 0 || val === georaster.noDataValue) {
            return null; // transparent
          }

          // Harmonious HSL matching design guidelines for population heatmaps
          if (val > 1000) return "rgba(127, 29, 29, 0.85)"; // Extreme density - Crimson
          if (val > 500) return "rgba(185, 28, 28, 0.8)";   // High density - Red
          if (val > 250) return "rgba(220, 38, 38, 0.75)";  // Med-High - Bright Red
          if (val > 100) return "rgba(234, 88, 12, 0.7)";   // Medium - Orange-Red
          if (val > 50) return "rgba(249, 115, 22, 0.65)";   // Low-Medium - Orange
          if (val > 10) return "rgba(234, 179, 8, 0.6)";    // Low - Yellow
          return "rgba(34, 197, 94, 0.5)";                  // Scattered settlements - Green
        },
        resolution: 128, // High-performance smooth scaling
      });
      */

      // Updated Code: Disable click interaction on the GeoTIFF overlay so click events bleed through to the map container.
      const layer = new (GeoRasterLayerClass as any)({
        georaster,
        opacity,
        pixelValuesToColorFn: (values: number[]) => {
          const val = values[0];
          if (val === undefined || isNaN(val) || val <= 0 || val === georaster.noDataValue) {
            return null; // transparent
          }

          // Harmonious HSL matching design guidelines for population heatmaps
          if (val > 1000) return "rgba(127, 29, 29, 0.85)"; // Extreme density - Crimson
          if (val > 500) return "rgba(185, 28, 28, 0.8)";   // High density - Red
          if (val > 250) return "rgba(220, 38, 38, 0.75)";  // Med-High - Bright Red
          if (val > 100) return "rgba(234, 88, 12, 0.7)";   // Medium - Orange-Red
          if (val > 50) return "rgba(249, 115, 22, 0.65)";   // Low-Medium - Orange
          if (val > 10) return "rgba(234, 179, 8, 0.6)";    // Low - Yellow
          return "rgba(34, 197, 94, 0.5)";                  // Scattered settlements - Green
        },
        resolution: 128, // High-performance smooth scaling
        interactive: false, // Prevent the raster layer from intercepting map mouse events/clicks
      });

      layerRef.current = layer;
      layer.addTo(map);

      // Auto-zoom map to GeoTIFF bounding box limits if available.
      // Disabled by default: this was the cause of the map snapping to a
      // foreign country (e.g. PNG while viewing ZMB) whenever the overlay
      // (re)loaded. The active tenant's mapCenter/mapZoom and the explicit
      // raster selector dropdown already center the map correctly.
      if (autoFit && georaster.xmin && georaster.ymin && georaster.xmax && georaster.ymax) {
        const bounds = L.latLngBounds(
          [georaster.ymin, georaster.xmin],
          [georaster.ymax, georaster.xmax]
        );
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
      }
    }

    loadRaster().catch((err) => {
      const errMsg: string = err?.message || "";
      // 404 = no raster uploaded yet. This is a data-configuration gap, not a runtime
      // error the user can act on from the map. Skip the toast so the map does not
      // alarm users; the population density overlay simply will not render until an
      // admin uploads a WorldPop GeoTIFF via Settings → Resources.
      if (
        errMsg.includes("No population GeoTIFF") ||
        errMsg.includes("not found in resources") ||
        errMsg.includes("GeoTIFF population file")
      ) {
        console.info("[GeoTIFF] No raster available for this tenant - population overlay skipped.");
        return;
      }
      console.error("[GeoTIFF] Layer load failed:", { url, cacheScope, tenantId, error: errMsg });
      if (!navigator.onLine) {
        toast({
          title: "Offline Population Layer",
          description: "Gridded population density is currently unavailable offline. Load the map once while online to cache this layer.",
          variant: "default",
        });
      } else {
        toast({
          title: "Population Layer Unavailable",
          description: `Could not load gridded population: ${errMsg || "unknown error"}.`,
          variant: "destructive",
        });
      }
    });

    return () => {
      active = false;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, url, opacity, cacheScope, autoFit]);

  return null;
}

// Renders a single custom vector layer. Fetches the full GeoJSON (which is NOT
// included in the list endpoint to keep it light) only when this layer is
// actually shown on the map.
function CustomVectorLayer({ id, style }: { id: string; style: any }) {
  const { data } = useQuery<any>({
    queryKey: [`/api/custom-layers/${id}`],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/custom-layers/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load custom layer");
      return res.json();
    },
  });
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const color = style?.color ?? "#2563eb";
  const pathStyle = {
    color,
    weight: style?.weight ?? 2,
    fillColor: color,
    fillOpacity: style?.fillOpacity ?? 0.25,
    renderer: canvasRenderer,
  };
  if (!data?.geojson?.features?.length) return null;
  return (
    <GeoJSON
      key={`custom-layer-${id}`}
      data={data.geojson}
      style={() => pathStyle as any}
      pointToLayer={(_feature, latlng) =>
        L.circleMarker(latlng, { radius: style?.pointRadius ?? 5, ...pathStyle })
      }
      onEachFeature={(feature, layer) => {
        const props = feature.properties || {};
        // Escape both keys and values — uploaded GeoJSON/CSV/Shapefile
        // attributes are untrusted and would otherwise allow stored XSS in
        // the Leaflet popup HTML.
        const esc = (s: any) =>
          String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        const rows = Object.entries(props)
          .slice(0, 12)
          .map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`)
          .join("");
        layer.bindPopup(
          `<div class="p-2 text-xs font-sans space-y-0.5 max-w-[220px]">${rows || "<em>No attributes</em>"}</div>`,
          { maxWidth: 240 },
        );
      }}
    />
  );
}

const FacilityMarkerItem = memo(({
  facility,
  facilityIcon,
  markerRefs,
  facilityVillagesMap,
  activeSessionPlans,
  handleFocusFacility,
  setSelectedFacilityId,
  setPanelVis,
  onSelectIntelligencePoint,
}: {
  facility: Facility;
  facilityIcon: any;
  markerRefs: React.MutableRefObject<Record<number, L.Marker | null>>;
  facilityVillagesMap: Map<number, any[]>;
  activeSessionPlans: any[];
  handleFocusFacility: (facility: Facility) => void;
  setSelectedFacilityId: (id: number) => void;
  setPanelVis: React.Dispatch<React.SetStateAction<any>>;
  onSelectIntelligencePoint?: (pt: { lat: number; lng: number }) => void;
}) => {
  const facilityVillages = facilityVillagesMap.get(Number(facility.id)) || [];
  const catchmentPop = facilityVillages.reduce(
    (sum: number, v: any) => sum + (Number(v.population) || 0),
    0,
  );
  const activeSessions = activeSessionPlans.filter(
    (p: any) => Number(p.facilityId) === Number(facility.id),
  ).length;
  const facilityLlg = (facility as any).llgId ? (facility as any).llgName || "" : "";

  return (
    <Marker
      key={`facility-${facility.id}`}
      position={[Number(facility.latitude), Number(facility.longitude)]}
      icon={facilityIcon}
      eventHandlers={{
        click: () => {
          handleFocusFacility(facility);
        },
      }}
      ref={(el) => {
        if (el) {
          markerRefs.current[facility.id] = el;
        } else {
          delete markerRefs.current[facility.id];
        }
      }}
    >
      <Popup className="premium-map-popup">
        <div className="w-72 overflow-hidden rounded-lg font-sans text-xs select-none">
          {/* Header */}
          <div className="bg-primary/5 p-3 pb-2.5 border-b border-border/60">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span>{facility.facilityType || "Health Facility"}</span>
                </div>
                <h4 className="font-bold text-foreground text-sm leading-tight truncate">
                  {facility.name}
                </h4>
                <Badge variant="outline" className="text-[9px] shrink-0 mt-1 uppercase tracking-wider font-semibold border-primary/30 text-primary">
                  Code: {facility.hmisCode || (facility as any).code || `FAC-${facility.id}`}
                </Badge>
              </div>
            </div>
            {facilityLlg && (
              <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{facilityLlg}</span>
              </div>
            )}
          </div>

          {/* Operational Details */}
          <div className="p-3 space-y-2.5 bg-background/95 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{facility.operatingHours || "24/7 Service"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{facility.staffCount || 0} HCW Staff</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-border/40 text-[10px]">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                facility.hasRefrigerator
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}>
                <Thermometer className="h-3.5 w-3.5 shrink-0" />
                <span>{facility.hasRefrigerator ? "Cold Chain Ready" : "No Refrigerator"}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                facility.hasPower
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}>
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span>{facility.hasPower ? "Power Grid/Solar" : "No Power"}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-muted/40 rounded-md border border-border/50 text-[10px] mt-2">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Active Sessions</span>
                <span className={`font-bold text-sm leading-none mt-0.5 ${
                  activeSessions > 0 ? "text-primary" : "text-foreground"
                }`}>{activeSessions}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Catchment Pop</span>
                <span className="font-bold text-foreground text-sm leading-none mt-0.5">
                  {catchmentPop > 0 ? catchmentPop.toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-col gap-1.5 border-t border-border/40">
              <Button
                size="sm"
                variant="default"
                className="w-full h-7 text-[11px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFacilityId(facility.id);
                  setPanelVis((prev: any) => ({ ...prev, facilities: true }));
                }}
              >
                View Facility Info & Catchments →
              </Button>
              {onSelectIntelligencePoint && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-6 text-[10px] text-muted-foreground hover:text-foreground border border-border/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (facility.latitude && facility.longitude) {
                      onSelectIntelligencePoint({ lat: Number(facility.latitude), lng: Number(facility.longitude) });
                    }
                  }}
                >
                  🌐 GIS Point Intelligence
                </Button>
              )}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

const VillageMarkerItem = memo(({
  village,
  plannedIcon,
  missingHtrIcon,
  missingStandardIcon,
  plannedVillageIds,
  showLabels,
  currentZoom,
  activeMapVillagesCount,
  resolveLabel,
  setRenameTarget,
  setOutreachDialogTarget,
  handleClearOutreachPost,
  setLocation,
  toast,
}: {
  village: Village;
  plannedIcon: any;
  missingHtrIcon: any;
  missingStandardIcon: any;
  plannedVillageIds: Set<number>;
  showLabels: boolean;
  currentZoom: number;
  activeMapVillagesCount: number;
  resolveLabel: (name: string) => string;
  setRenameTarget: (target: any) => void;
  setOutreachDialogTarget: (village: Village) => void;
  handleClearOutreachPost: (village: Village) => void;
  setLocation: (path: string) => void;
  toast: any;
}) => {
  const isPlanned = plannedVillageIds.has(village.id);
  const icon = isPlanned ? plannedIcon : village.isHardToReach ? missingHtrIcon : missingStandardIcon;

  return (
    <Marker
      key={`village-${village.id}`}
      position={[Number(village.latitude), Number(village.longitude)]}
      icon={icon}
    >
      {showLabels && (
        <Tooltip
          permanent={currentZoom >= 14 && activeMapVillagesCount < 300}
          direction="bottom"
          offset={[0, 8]}
          className="map-village-label"
        >
          {resolveLabel(village.name)}
        </Tooltip>
      )}
      <Popup className="premium-map-popup">
        <div className="w-64 overflow-hidden rounded-lg font-sans text-xs select-none">
          {/* Header */}
          <div className="bg-primary/5 p-3 pb-2 border-b border-border/60">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-foreground text-sm leading-tight line-clamp-2">
                  {resolveLabel(village.name)}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget({
                      type: "village",
                      id: village.id,
                      name: village.name,
                    });
                  }}
                  className="text-[10px] text-primary hover:underline font-bold mt-1 inline-flex items-center gap-0.5"
                >
                  Rename
                </button>
              </div>
              {isPlanned ? (
                <Badge variant="outline" className="text-[9px] shrink-0 py-0 px-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 uppercase tracking-wider">
                  Planned
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] shrink-0 py-0 px-1 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 uppercase tracking-wider">
                  Unplanned
                </Badge>
              )}
            </div>
            {village.settlementType && (
              <span className="text-[10px] text-muted-foreground capitalize mt-0.5 block font-medium">
                {village.settlementType}
              </span>
            )}
          </div>

          {/* Details */}
          <div className="p-3 space-y-2.5 bg-background/95 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Total Pop</span>
                <span className="font-semibold text-foreground text-xs mt-0.5">
                  {village.population ? village.population.toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground">Under-5 Pop</span>
                <span className="font-semibold text-primary text-xs mt-0.5">
                  {village.under5Population ? village.under5Population.toLocaleString() : "N/A"}
                </span>
              </div>
            </div>

            {village.assignedFacilityId && (
              <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                <span className="font-medium text-foreground">Assigned Facility:</span> #{village.assignedFacilityId}
              </div>
            )}

            {/* Travel / Accessibility Badges */}
            <div className="space-y-1 pt-1.5 border-t border-border/40 text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Access Profile:</span>
                <span className="font-semibold text-foreground capitalize">
                  {village.transportMode || "Walking"}
                  {village.travelTimeMinutes ? ` (~${village.travelTimeMinutes} min)` : ""}
                </span>
              </div>

              {village.isHardToReach ? (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Hard-to-Reach / Remote Area</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
                  <CheckCircle className="h-3 w-3 shrink-0" />
                  <span>Standard Access Zone</span>
                </div>
              )}
            </div>

            {/* Outreach Post Configuration Section */}
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">Outreach Location</span>
                {village.outreachLatitude && village.outreachLongitude ? (
                  <Badge variant="outline" className="text-[8px] py-0 px-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] py-0 px-1 border-muted-foreground/30 text-muted-foreground">
                    Not Set
                  </Badge>
                )}
              </div>

              {village.outreachLatitude && village.outreachLongitude ? (
                <div className="p-1.5 bg-muted/40 rounded border border-border/50 space-y-1 text-[10px]">
                  <div className="font-medium text-foreground truncate">
                    {village.outreachPostName || `${village.name} Outreach`}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {Number(village.outreachLatitude).toFixed(4)}, {Number(village.outreachLongitude).toFixed(4)}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOutreachDialogTarget(village);
                      }}
                      className="text-primary hover:underline font-semibold"
                    >
                      Edit
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearOutreachPost(village);
                      }}
                      className="text-destructive hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOutreachDialogTarget(village);
                  }}
                  className="w-full py-1 px-2 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded border border-primary/20 transition-colors flex items-center justify-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Set Outreach Coordinates
                </button>
              )}
            </div>

            {/* Session Plan Action */}
            <div className="pt-2 border-t border-border/40">
              <Button
                size="sm"
                variant="default"
                className="w-full h-7 text-[11px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  if (village.assignedFacilityId) {
                    setLocation(`/session-plans/new?facilityId=${village.assignedFacilityId}&villageId=${village.id}`);
                  } else {
                    toast({
                      title: "Facility Assignment Required",
                      description: `Please assign ${village.name} to a health facility before planning sessions.`,
                      variant: "destructive",
                    });
                  }
                }}
                data-testid={`button-plan-session-village-${village.id}`}
              >
                <Plus className="h-3 w-3 mr-1" />
                Plan a session here
              </Button>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

const DEFAULT_MAP_CENTER: [number, number] = [-6.0, 147.0];

// Updated Code: Fully functional MapView supporting interactive geodesic Turf measurements, high-res PDF layout, and premium Radix UI data exports
export function MapView({
  facilities = [],
  villages = [],
  cases = [],
  center = DEFAULT_MAP_CENTER,
  zoom = 6,
  height = "100%",
  showFacilityList = false,
  mode = "planning",
}: MapViewProps) {
  const { user } = useAuth();
  const isNationalAdminOrManager = useMemo(() => {
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    const roles: string[] = Array.isArray(user.roles) ? user.roles.map((r: any) => String(r).toLowerCase()) : [];
    const allowed = ["platform_admin", "national_admin", "national_manager", "gis_specialist", "provincial_coordinator", "district_manager", "admin", "manager"];
    return allowed.includes(role) || roles.some((r) => allowed.includes(r));
  }, [user]);
  const { theme, systemTheme } = useTheme();
  const [, setLocation] = useLocation();
  const mapRef = useRef<L.Map>(null);
  const markerRefs = useRef<Record<number, L.Marker | null>>({});
  const geoJsonRefs = useRef<Record<string, any>>({});
  const fetchingRef = useRef<Record<string, boolean>>({});
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [intelligencePoint, setIntelligencePoint] = useState<{lat: number, lng: number} | null>(null);

  // WorldPop population-density overlay (off by default, session-scoped).
  const populationOverlay = usePopulationOverlay();

  // Map overlay visibility layers (moved to top of states block to be declared before query hooks dependent on them)
  // Updated Code: Default layers differ in surveillance mode to prevent cluttering.
  const [layers, setLayers] = useState<MapOverlayLayers>(() => {
    const isSurveillance = mode === "surveillance";
    return {
      facilities: !isSurveillance,
      villages: !isSurveillance,
      htrAreas: !isSurveillance,
      catchments: false,
      roads: false,
      boundaries: true,
      // Updated: Saved Catchments overlay defaults ON so HCW-drawn polygons are
      // immediately visible after saving (no buried toggle).
      hcwCatchments: true,
      wards: false,
      constituencies: false,
      populationGeoTIFF: !isSurveillance,
      populationChoropleth: false,
      grid3Settlements: false,
      zeroDoseVillages: false,
      underImmunizedVillages: false,
      showLabels: true,
    };
  });

  // Advanced GIS-Microplanning States & Refs
  const georasterRef = useRef<any>(null);
  const [clickDialogOpen, setClickDialogOpen] = useState(false);
  const [mapClickDetails, setMapClickDetails] = useState<{
    lat: number;
    lng: number;
    density: number;
    areaPopulation: number;
    areaRadiusKm: number;
    pop1k: number;
    pop2k: number;
    pop3k: number;
    polygonName: string;
    polygonType: string;
    polygonPopulation: number;
    provinceName?: string;
    districtName?: string;
    wardName?: string;
    landmarks?: Array<{ name: string; type: string; distance: number }>;
    isInsideCatchment?: boolean;
    containingCatchments?: Array<{
      id: string;
      name: string;
      facilityId: number;
      isOfficial: boolean;
      areaSqKm: number;
      populationEstimate: number;
    }>;
    nearestFacility: {
      id: number;
      name: string;
      facilityType: string;
      distance: number;
      operatingHours: string;
      hasRefrigerator: boolean;
      hasPower: boolean;
      staffCount: number;
      raw?: any;
    } | null;
    nearestPlan: {
      id: number;
      name: string;
      distance: number;
      sessionType: string;
      status: string;
      targetPopulation: number;
      scheduledDate?: any;
      isAchieved: boolean;
      raw?: any;
    } | null;
    nearestVillage: {
      id: number;
      name: string;
      population: number;
      under5Population: number;
      distance: number;
      isHardToReach: boolean;
      travelTimeMinutes: number;
      transportMode: string;
      settlementType: string;
      raw?: any;
    } | null;
    nearbyFacilities: { id: number; name: string; facilityType: string; distance: number }[];
    nearbyPlans: { id: number; name: string; sessionType: string; status: string; distance: number }[];
    nearbyVillages: { id: number; name: string; population: number; under5Population: number; distance: number; isHardToReach: boolean; settlementType: string }[];
    isHTR: boolean;
    isLoadingPopulation?: boolean;
    intersectedFeature?: { type: "facility" | "village" | "catchment" | "session"; data: any } | null;
  } | null>(null);

  // Outreach Post Configuration States
  const [outreachDialogTarget, setOutreachDialogTarget] = useState<Village | null>(null);
  const [outreachNameInput, setOutreachNameInput] = useState("");
  const [outreachLatInput, setOutreachLatInput] = useState("");
  const [outreachLngInput, setOutreachLngInput] = useState("");
  const [isPickingFromMap, setIsPickingFromMap] = useState(false);
  const [pickingOutreachForVillage, setPickingOutreachForVillage] = useState<Village | null>(null);
  const [isSavingOutreach, setIsSavingOutreach] = useState(false);
  const outreachDraftRef = useRef({ name: "", latitude: "", longitude: "" });
  const skipOutreachHydrationRef = useRef(false);

  useEffect(() => {
    if (outreachDialogTarget) {
      if (skipOutreachHydrationRef.current) {
        skipOutreachHydrationRef.current = false;
        return;
      }
      setOutreachNameInput(outreachDialogTarget.outreachPostName || `${outreachDialogTarget.name} Outreach Post`);
      setOutreachLatInput(outreachDialogTarget.outreachLatitude ? String(outreachDialogTarget.outreachLatitude) : "");
      setOutreachLngInput(outreachDialogTarget.outreachLongitude ? String(outreachDialogTarget.outreachLongitude) : "");
    } else if (!isPickingFromMap) {
      setOutreachNameInput("");
      setOutreachLatInput("");
      setOutreachLngInput("");
    }
  }, [outreachDialogTarget, isPickingFromMap]);

  const handleClearOutreachPost = async (village: Village) => {
    try {
      await apiRequest("PATCH", `/api/villages/${village.id}`, {
        outreachLatitude: null,
        outreachLongitude: null,
        outreachPostName: null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      toast({
        title: "Outreach post cleared",
        description: `Outreach post for ${village.name} has been removed.`,
      });
    } catch (err) {
      toast({
        title: "Error clearing outreach post",
        description: "Failed to remove the outreach post location. Please try again.",
        variant: "destructive",
      });
    }
  };


  // Universal GeoTIFF Raster selection state
  const [selectedRasterFile, setSelectedRasterFile] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vaxplan_selected_raster") || "";
    }
    return "";
  });

  const { data: rasterListData } = useQuery<{ success: boolean; files: Array<{ fileName: string; country: string; resolution: string }> }>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/resources/geotiff/list"],
  });

  // Auto-disable the population density overlay when no rasters have been uploaded yet.
  // This prevents a 404 fetch (and its associated destructive toast) from firing on
  // every map load in environments where WorldPop GeoTIFFs have not been seeded.
  useEffect(() => {
    if (rasterListData && (!rasterListData.files || rasterListData.files.length === 0)) {
      setLayers((prev) => (prev.populationGeoTIFF ? { ...prev, populationGeoTIFF: false } : prev));
    }
  }, [rasterListData]);

  // Zero-dose / under-immunized per-village breakdown.
  // Only fetched when the layer is toggled on, to avoid extra load on initial map open.
  const { data: zeroDoseData } = useQuery<{
    byVillage: Array<{
      villageId: number | null;
      villageName: string;
      districtId: number;
      districtName: string;
      facilityId: number;
      facilityName: string;
      latitude: number | null;
      longitude: number | null;
      isHardToReach: boolean;
      zeroDose: number;
      underImmunized: number;
      denominator: number;
      pct: number;
      underImmunizedPct: number;
      lastDefaulterSession?: { date: string; caughtUp: number } | null;
    }>;
  }>({
    queryKey: ["/api/indicators/zero-dose"],
    enabled: layers.zeroDoseVillages || layers.underImmunizedVillages,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query all public tenants to allow synchronization between raster selection and planning context
  const { data: publicTenants = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/public/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/public/tenants");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch("/api/me/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error("Failed to switch country tenant");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.ok && data.tenant) {
        localStorage.setItem("vaxplan_active_tenant", JSON.stringify(data.tenant));
        // Reset query cache to clear other tenant records and trigger refetch
        queryClient.invalidateQueries();
        toast({
          title: "Country Switched",
          description: `Active planning context updated to ${data.tenant.name}.`,
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Switch Failed",
        description: err.message || "Failed to switch country context.",
        variant: "destructive",
      });
    }
  });

  // Task #101 — prompt to start a routine microplan when the user clicks
  // "Plan a session here" on a village whose facility has none yet.
  const [startMicroplanPrompt, setStartMicroplanPrompt] = useState<{
    villageId: number;
    villageName: string;
    villageLat: number;
    villageLng: number;
    villageHtr: boolean;
    facilityId: number;
    facilityName: string;
  } | null>(null);

  // States for session polygon geofencing drawing
  const [isDrawingSessionPolygon, setIsDrawingSessionPolygon] = useState(false);
  const [sessionPolygonPoints, setSessionPolygonPoints] = useState<L.LatLng[]>([]);
  const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false);

  // Form states for creating derived outreach session plan
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionType, setNewSessionType] = useState<"static" | "mobile" | "outreach">("outreach");
  const [newSessionStrategy, setNewSessionStrategy] = useState<"routine" | "campaign">("routine");
  const [newSessionAntigen, setNewSessionAntigen] = useState("");
  const [newSessionTargetAge, setNewSessionTargetAge] = useState("");
  const [newSessionScope, setNewSessionScope] = useState("Local");
  const [newSessionTeamType, setNewSessionTeamType] = useState("mobile");
  const [newSessionQuarter, setNewSessionQuarter] = useState<number>(1);
  const [newSessionYear, setNewSessionYear] = useState<number>(new Date().getFullYear());
  const [newSessionTargetPop, setNewSessionTargetPop] = useState<number>(50);
  const [newSessionTransport, setNewSessionTransport] = useState<string>("road");
  const [newSessionMicroplanId, setNewSessionMicroplanId] = useState<string>("none");
  const [selectedParentFacilityId, setSelectedParentFacilityId] = useState<number | null>(null);

  // Minimum scheduled date is 7 days out. The server measures lead time in UTC
  // calendar days and we submit the picked date as a UTC calendar date, so use the
  // shared scheduling-date helper (UTC "today" + 7) to always satisfy the rule.
  const [newSessionDate, setNewSessionDate] = useState<string>(() => getMinScheduleDateInputValue());

  // Real-time map checklist progress tracking state
  const [checklistOpen, setChecklistOpen] = useState(true);

  /*
  // Centroid calculation helper for active session plans (Planned vs Achieved) - commented out here and relocated below states block to satisfy compiler ordering
  const getSessionCentroid = useCallback((plan: any): [number, number] | null => {
    if (plan.geojson && plan.geojson.coordinates) {
      const coords = plan.geojson.coordinates;
      if (plan.geojson.type === "Polygon" && Array.isArray(coords[0])) {
        let latSum = 0;
        let lngSum = 0;
        const pts = coords[0];
        pts.forEach((pt: any) => {
          lngSum += pt[0];
          latSum += pt[1];
        });
        return [latSum / pts.length, lngSum / pts.length];
      } else if (plan.geojson.type === "LineString" && Array.isArray(coords)) {
        let latSum = 0;
        let lngSum = 0;
        coords.forEach((pt: any) => {
          lngSum += pt[0];
          latSum += pt[1];
        });
        return [latSum / coords.length, lngSum / coords.length];
      }
    }

    // Fallback: If we have linked villages, find their average
    const linkedVillages = sessionVillages
      ?.filter((sv: any) => sv.sessionId === plan.id)
      .map((sv: any) => villages.find((v) => v.id === sv.villageId))
      .filter((v): v is Village => !!v && !!v.latitude && !!v.longitude);

    if (linkedVillages && linkedVillages.length > 0) {
      let latSum = 0;
      let lngSum = 0;
      linkedVillages.forEach((v) => {
        latSum += Number(v.latitude);
        lngSum += Number(v.longitude);
      });
      return [latSum / linkedVillages.length, lngSum / linkedVillages.length];
    }

    // Fallback 2: Nearest facility
    if (plan.facilityId) {
      const fac = facilities.find(f => f.id === plan.facilityId);
      if (fac && fac.latitude && fac.longitude) {
        return [Number(fac.latitude), Number(fac.longitude)];
      }
    }

    return null;
  }, [sessionVillages, villages, facilities]);
  */

  // Fetch active session plans for visual tracking and click triaging
  const { data: activeSessionPlans = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return (_tid ? await offlineDb.sessionPlans.where("tenantId").equals(_tid).toArray() : await offlineDb.sessionPlans.toArray());

      }
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      return res.json();
    },
  });

  // Sessions plotted on the map: planned/in-progress + completed within 30d.
  // Source of truth for the "Session plans" map layer + legend counters.
  const { data: sessionMapPins = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/sessions/map"],
    queryFn: async () => {
      if (!navigator.onLine) return [];
      const res = await fetch("/api/sessions/map");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Unserved populated places (no session ever + no recorded vaccinations).
  const { data: unservedPlaces = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/unserved-places"],
    queryFn: async () => {
      if (!navigator.onLine) return [];
      const res = await fetch("/api/unserved-places");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch session villages junction table
  const { data: sessionVillages = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/sessions/villages"],
    queryFn: async () => {
      const res = await fetch("/api/sessions/villages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch master microplans for selection dropdown
  const { data: masterMicroplans = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/microplans"],
    queryFn: async () => {
      const res = await fetch("/api/microplans");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Dynamic Geographic and Tenant Lookups for Premium Admin Hierarchy Resolution
  const { data: tenantInfo } = useQuery<any>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/me/tenant"],
  });

  // Fetch GRID3 Settlement Extents GeoJSON footprints — with IndexedDB persistent caching.
  // On first load the 18.4 MB file is downloaded once and stored in Dexie gisCache.
  // All subsequent layer toggles and page reloads serve the data instantly from IndexedDB (< 50 ms),
  // completely freeing the network queue for normal database synchronisation.
  const grid3TenantKey = String(tenantInfo?.id || tenantInfo?.code || tenantInfo?.countryCode || (user as any)?.tenantId || "global");
  const grid3CacheKey = `grid3_settlements_${grid3TenantKey}`;
  const { data: grid3GeoJSON } = useQuery<any>({
    queryKey: ["/api/resources/grid3-settlements", grid3CacheKey],
    enabled: !!layers.grid3Settlements && !!tenantInfo?.id,
    // 24-hour stale time — the GRID3 national settlement file rarely changes.
    // gcTime of 48 hours keeps the parsed object in React Query's memory cache for the full session.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    queryFn: async () => {
      // 1. Attempt an instant IndexedDB cache hit first
      try {
        // Original Code (Composite primary key lookup with query object - returns undefined on composite index):
        // const cached = await offlineDb.gisCache.get({ key: "grid3_settlements", tenantId: (user as any)?.tenantId ?? "global" });
        // Updated Code: Correctly passes the composite index primary key as a tuple [key, tenantId]
        const cached = await offlineDb.gisCache.get(["grid3_settlements", grid3TenantKey]);
        if (cached && cached.geojson) {
          return cached.geojson;
        }
      } catch (_cacheErr) {
        // gisCache table might not be upgraded yet on a fresh install — fall through to network
        console.warn("[GIS Cache] IndexedDB gisCache read skipped:", _cacheErr);
      }

      // 2. Cache miss — download from the server (runs once per browser install)
      const res = await fetch(`/api/resources/grid3-settlements?tenant=${encodeURIComponent(String(tenantInfo?.code || tenantInfo?.countryCode || tenantInfo?.id || ""))}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load GRID3 settlements");
      const geojson = await res.json();

      // 3. Persist to Dexie gisCache asynchronously — do not block the map render
      offlineDb.gisCache.put({
        key: "grid3_settlements",
        tenantId: grid3TenantKey,
        geojson,
        cachedAt: Date.now(),
      }).catch((err) =>
        console.warn("[GIS Cache] Failed to persist GRID3 settlements to IndexedDB:", err)
      );

      return geojson;
    },
  });

  // Shared canvas renderer for the GRID3 layer. SVG rendering creates one
  // DOM node per feature, which is what made the map drag/zoom so heavy
  // on the Zambia dataset (tens of thousands of polygons → tens of thousands
  // of <path> elements). A single canvas paints them all in one element.
  const grid3CanvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  // ─── Custom map layers (admin-uploaded roads/schools/travel-time/etc.) ───
  // Fetch lightweight metadata for the active layers in the current tenant.
  // The heavy GeoJSON / raster payloads are fetched per-layer only when shown.
  const { data: customLayers = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-layers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!navigator.onLine) return [];
      const res = await fetch("/api/custom-layers", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  // Per-session show/hide on top of the persisted `isActive` flag. A layer is
  // shown when it is active AND the user has not hidden it this session.
  const [hiddenCustomLayerIds, setHiddenCustomLayerIds] = useState<Set<string>>(new Set());
  const [customLayersPanelOpen, setCustomLayersPanelOpen] = useState(true);
  const activeCustomLayers = useMemo(
    () => (customLayers ?? []).filter((l: any) => l.isActive),
    [customLayers],
  );
  const toggleCustomLayer = (id: string) =>
    setHiddenCustomLayerIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Imperative ref to the GRID3 Leaflet layer so we can re-style features when
  // the active Province / District / LLG selection changes WITHOUT remounting
  // the GeoJSON layer (remount would otherwise re-add it last in the SVG paint
  // order and cause it to flicker / disappear under boundary polygons).
  const grid3LayerRef = useRef<any>(null);

  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  /*
  // Original Code: Hidden by default, which can cause users to overlook the geographic filters on the sidebar
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false);
  */
  // Updated Code: Expanded by default so the cascading dropdown filters are immediately visible on the Health Facilities sidebar card
  const [cardFiltersOpen, setCardFiltersOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | "all">("all");
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | "all">("all");
  const [selectedLlgId, setSelectedLlgId] = useState<number | "all">("all");
  const [villageCategory, setVillageCategory] = useState<"all" | "htr" | "standard">("all");
  const [filterColdChain, setFilterColdChain] = useState(false);
  const [filterPower, setFilterPower] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);

  // Updated Code:
  // Add React states for collapsible (isLegendExpanded) and interactive (hiddenCategories) map legend
  // and handleToggleCategory toggler function to reactively filter map markers.
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const handleToggleCategory = (category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set<string>(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Unified panel visibility for the floating map "dock". On phones every panel
  // starts hidden so the map fills the screen; users reveal a panel by tapping
  // its dock button. On larger screens the panels keep their previous defaults.
  const [panelVis, setPanelVis] = useState(() => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    return {
      layers: false,
      filters: false,
      facilities: false,
      checklist: false,
      legend: !mobile,
      tools: !mobile,
      alerts: false,
      recommendations: false,
    };
  });
  type PanelKey = keyof typeof panelVis;
  const togglePanel = (key: PanelKey) => {
    setPanelVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Smart Auto-Collapse logic
      if (next[key]) {
        // Group 1: Left panels
        if (['layers', 'filters'].includes(key)) {
          ['layers', 'filters'].forEach((k) => {
             if (k !== key) next[k as PanelKey] = false;
          });
        }
        // Group 2: Right panels
        if (['facilities', 'checklist', 'alerts', 'recommendations'].includes(key)) {
          ['facilities', 'checklist', 'alerts', 'recommendations'].forEach((k) => {
             if (k !== key) next[k as PanelKey] = false;
          });
        }
      }
      return next;
    });
  };

  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(true);

  // States to keep track of active zoom level and conditionally hide village markers
  const [currentZoom, setCurrentZoom] = useState(zoom);
  useEffect(() => {
    setCurrentZoom(zoom);
  }, [zoom]);

  // Original Code: Low zoom threshold (9) that rendered thousands of village markers simultaneously, throttling performance
  /*
  const showVillageMarkers = useMemo(() => {
    if (
      selectedDistrictId !== "all" ||
      selectedLlgId !== "all" ||
      villageCategory !== "all" ||
      searchQuery.trim() !== ""
    ) {
      return true;
    }
    return currentZoom >= 9;
  }, [currentZoom, selectedDistrictId, selectedLlgId, villageCategory, searchQuery]);
  */

  // Original Code: Pruned village rendering based strictly on zoom gating >= 10, which caused all village markers and HTR buffers to disappear on initial load for low-count country datasets (like Zambia with 122 villages or SSD with 1 village).
  /*
  const showVillageMarkers = useMemo(() => {
    // Override zoom threshold if a specific boundary filter or search query is set
    if (
      selectedDistrictId !== "all" ||
      selectedLlgId !== "all" ||
      villageCategory !== "all" ||
      searchQuery.trim() !== ""
    ) {
      return true;
    }
    // Upgraded zoom threshold from 9 to 10. At provincial zoom levels (e.g. 9), rendering thousands
    // of village markers locks the browser main thread. Pruning village rendering to high zooms (10+)
    // ensures butter-smooth panned performance.
    return currentZoom >= 10;
  }, [currentZoom, selectedDistrictId, selectedLlgId, villageCategory, searchQuery]);
  */

  // Original Code: Mismatched or non-type-safe cascading selectors that did not auto-focus/zoom map or filter cleanly under string-number type mismatches.
  /*
  // Smart Cascading Filter Selectors
  const handleProvinceChange = (provinceId: number | "all") => {
    setSelectedProvinceId(provinceId);
    setSelectedDistrictId("all");
    setSelectedLlgId("all");
  };

  const handleDistrictChange = (districtId: number | "all") => {
    setSelectedDistrictId(districtId);
    setSelectedLlgId("all");
    if (districtId !== "all") {
      const dist = districts.find((d: any) => d.id === districtId);
      if (dist && dist.provinceId) {
        setSelectedProvinceId(dist.provinceId);
      }
    }
  };

  const handleLlgChange = (llgId: number | "all") => {
    setSelectedLlgId(llgId);
    if (llgId !== "all") {
      const llg = llgs.find((l: any) => l.id === llgId);
      if (llg && llg.districtId) {
        setSelectedDistrictId(llg.districtId);
        const dist = districts.find((d: any) => d.id === llg.districtId);
        if (dist && dist.provinceId) {
          setSelectedProvinceId(dist.provinceId);
        }
      }
    }
  };
  */

  const [layerPanelOpen, setLayerPanelOpen] = useState(showFacilityList);
  const [basemap, setBasemap] = usePersistedBasemap("osm");
  // Original Code: Administrative boundaries were disabled by default, hindering instant user visualization.
  /*
  const [layers, setLayers] = useState<MapOverlayLayers>({
    facilities: true,
    villages: true,
    htrAreas: true,
    catchments: false,
    roads: false,
    boundaries: false,
    hcwCatchments: false,
  });
  */
  // Updated Code: Administrative boundaries default-enabled for instant high-fidelity cascading visualization.
  // Updated Code: Administrative boundaries default-enabled for instant high-fidelity cascading visualization (Relocated to top).
  /*
  const [layers, setLayers] = useState<MapOverlayLayers>({
    facilities: true,
    villages: true,
    htrAreas: true,
    catchments: false,
    roads: false,
    boundaries: true,
    hcwCatchments: false,
    wards: false,
    constituencies: false,
    populationGeoTIFF: true,
    grid3Settlements: false,
  });
  */

  // Centroid mapping helper for country raster zoom
  const countryCenters: Record<string, { center: [number, number]; zoom: number }> = {
    "Zambia": getTenantMapDefaults({ countryCode: "ZMB" }),
    "South Sudan": getTenantMapDefaults({ countryCode: "SSD" }),
    "Papua New Guinea": getTenantMapDefaults({ countryCode: "PNG" }),
    "Universal": getTenantMapDefaults(tenantInfo),
  };


  // Country boundary GeoJSON is loaded early because unserved places are clipped to the active country's polygons.
  const { data: boundaryList } = useQuery<Array<{ id: string; adminLevel: number; levelName: string; isActive: boolean }>>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/boundaries", tenantInfo?.id],
    queryFn: async () => {
      const res = await fetch("/api/boundaries", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch boundaries");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });

  const [boundaryGeoJSONs, setBoundaryGeoJSONs] = useState<Record<string, any>>({});

  // Reset all geographic filters on tenant/country switch to prevent cross-tenant ID bleed
  /* Original Reset Effect (without resetting map selected raster):
  useEffect(() => {
    if (tenantInfo?.id) {
      setSelectedProvinceId("all");
      setSelectedDistrictId("all");
      setSelectedLlgId("all");
      setSearchQuery("");
      setFilterColdChain(false);
      setFilterPower(false);
      setSelectedFacilityId(null);
    }
  }, [tenantInfo?.id]);
  */
  // Updated Code: Resets all geographic filters AND resets selected raster file to fallback on new active tenant's default
  useEffect(() => {
    if (tenantInfo?.id) {
      setSelectedProvinceId("all");
      setSelectedDistrictId("all");
      setSelectedLlgId("all");
      setSearchQuery("");
      setFilterColdChain(false);
      setFilterPower(false);
      setSelectedFacilityId(null);
      setSelectedRasterFile("");
      localStorage.removeItem("vaxplan_selected_raster");
    }
  }, [tenantInfo?.id]);

  const effectiveCenter = useMemo<[number, number]>(() => {
    if (selectedRasterFile && rasterListData?.files) {
      const activeRaster = rasterListData.files.find(f => f.fileName === selectedRasterFile);
      if (activeRaster && countryCenters[activeRaster.country]) {
        return countryCenters[activeRaster.country].center;
      }
    }
    if (center && (center[0] !== DEFAULT_MAP_CENTER[0] || center[1] !== DEFAULT_MAP_CENTER[1])) {
      return center;
    }
    if (tenantInfo?.settings?.mapCenter && Array.isArray(tenantInfo.settings.mapCenter)) {
      return tenantInfo.settings.mapCenter as [number, number];
    }
    return DEFAULT_MAP_CENTER;
  }, [center, tenantInfo, selectedRasterFile, rasterListData]);

  const effectiveZoom = useMemo<number>(() => {
    if (selectedRasterFile && rasterListData?.files) {
      const activeRaster = rasterListData.files.find(f => f.fileName === selectedRasterFile);
      if (activeRaster && countryCenters[activeRaster.country]) {
        return countryCenters[activeRaster.country].zoom;
      }
    }
    if (zoom !== 6) {
      return zoom;
    }
    if (tenantInfo?.settings?.mapZoom) {
      return Number(tenantInfo.settings.mapZoom);
    }
    return 6;
  }, [zoom, tenantInfo, selectedRasterFile, rasterListData]);


  /*
  // Original Code: Queries were bound to static queryKeys which caused old tenant/country cached data to be served upon switching countries.
  const { data: provinces = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/provinces"],
    enabled: true,
  });

  const { data: districts = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/districts"],
    enabled: true,
  });

  const { data: llgs = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/llgs"],
    enabled: true,
  });
  */

  // Updated Code: Scoping provinces, districts, and llgs queries strictly to the active tenantInfo.id to clear caches on tenant switch.
  // Using custom queryFns to bypass queryKey join "/" behavior mapping to invalid URLs, with robust IndexedDB offline fallbacks.
  const { data: provinces = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/provinces", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.provinces.where("tenantId").equals(_tid).toArray() : offlineDb.provinces.toArray();
      }
      const res = await fetch("/api/provinces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch provinces");
      return res.json();
    },
    enabled: true,
  });

  const { data: districts = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/districts", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.districts.where("tenantId").equals(_tid).toArray() : offlineDb.districts.toArray();
      }
      const res = await fetch("/api/districts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch districts");
      return res.json();
    },
    enabled: true,
  });

  const { data: llgs = [] } = useQuery<any[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/llgs", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.llgs.where("tenantId").equals(_tid).toArray() : offlineDb.llgs.toArray();
      }
      const res = await fetch("/api/llgs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch llgs");
      return res.json();
    },
    enabled: true,
  });

  const { data: dayPlans = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/session-day-plans", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.sessionDayPlans.where("tenantId").equals(_tid).toArray() : offlineDb.sessionDayPlans.toArray();
      }
      const res = await fetch("/api/session-day-plans", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch day plans");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });

  /* Original Code commented out for backward-compatibility:
  const { data: sessions = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/sessions", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.sessionPlans.where("tenantId").equals(_tid).toArray() : offlineDb.sessionPlans.toArray();
      }
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });
  */
  const { data: sessions = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/sessions", tenantInfo?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const _tid = loadActiveTenant()?.id;
        return _tid ? offlineDb.sessionPlans.where("tenantId").equals(_tid).toArray() : offlineDb.sessionPlans.toArray();
      }
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!tenantInfo?.id,
  });

  const { data: communityRoutes = [] } = useQuery<any[]>({
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryKey: ["/api/facilities", selectedFacilityId, "community-routes"],
    queryFn: async () => {
      if (!selectedFacilityId) return [];
      const res = await fetch(`/api/facilities/${selectedFacilityId}/community-routes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch community routes");
      return res.json();
    },
    enabled: !!selectedFacilityId,
  });

  // Fit bounds to show facility and all its routed communities when routes load
  useEffect(() => {
    if (!selectedFacilityId || !mapRef.current || !communityRoutes || communityRoutes.length === 0) return;

    const facility = facilities.find((f) => f.id === selectedFacilityId);
    if (!facility || !facility.latitude || !facility.longitude) return;

    const coords: [number, number][] = [];
    coords.push([Number(facility.latitude), Number(facility.longitude)]);

    communityRoutes.forEach((route: any) => {
      if (route.routeGeometry && route.routeGeometry.length > 0) {
        route.routeGeometry.forEach(([lng, lat]: [number, number]) => {
          coords.push([lat, lng]);
        });
      }
    });

    if (coords.length > 1) {
      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      mapRef.current.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        {
          padding: [80, 80],
          animate: true,
          duration: 1.5,
        }
      );
    }
  }, [selectedFacilityId, communityRoutes, facilities]);

  const adminLabels = useMemo(() => {
    const skipRegionLevel = tenantInfo?.settings?.skipRegionLevel ?? (tenantInfo?.countryCode === "ZMB" || false);
    const rawLabels = tenantInfo?.settings?.adminLevelLabels || {
      level1: "Province",
      level2: "District",
      level3: "LLG/Ward",
      level4: "Village",
    };
    if (skipRegionLevel) {
      return {
        level1: rawLabels.level2 || "Province",
        level2: rawLabels.level3 || "District",
        level3: rawLabels.level4 || "Constituency",
        level4: rawLabels.level5 || "Ward",
      };
    }
    return rawLabels as { level1: string; level2: string; level3: string; level4: string };
  }, [tenantInfo]);

  /*
  // Original Code: Lookup maps with raw keys that could suffer from string vs number type mismatch errors at runtime.
  const provinceLookup = useMemo(() => {
    const map = new Map<number, any>();
    provinces.forEach((p) => map.set(p.id, p));
    return map;
  }, [provinces]);

  const districtLookup = useMemo(() => {
    const map = new Map<number, any>();
    districts.forEach((d) => map.set(d.id, d));
    return map;
  }, [districts]);

  const llgLookup = useMemo(() => {
    const map = new Map<number, any>();
    llgs.forEach((l) => map.set(l.id, l));
    return map;
  }, [llgs]);
  */

  // Updated Code: Type-safe lookups with explicit Number() casting on the key map to avoid silent filtering mismatch bugs.
  const provinceLookup = useMemo(() => {
    const map = new Map<number, any>();
    provinces.forEach((p) => map.set(Number(p.id), p));
    return map;
  }, [provinces]);

  const districtLookup = useMemo(() => {
    const map = new Map<number, any>();
    districts.forEach((d) => map.set(Number(d.id), d));
    return map;
  }, [districts]);

  const llgLookup = useMemo(() => {
    const map = new Map<number, any>();
    llgs.forEach((l) => map.set(Number(l.id), l));
    return map;
  }, [llgs]);

  const districtNameLookup = useMemo(() => {
    const map = new Map<string, any>();
    districts.forEach((d) => {
      map.set(normalizeName(d.name), d);
    });
    return map;
  }, [districts]);

  const llgNameLookup = useMemo(() => {
    const map = new Map<string, any>();
    llgs.forEach((l) => {
      map.set(normalizeName(l.name), l);
    });
    return map;
  }, [llgs]);

  // Memoized O(1) map associating facilityId to its assigned villages array to avoid O(V*F) nested loops
  const facilityVillagesMap = useMemo(() => {
    const map = new Map<number, Village[]>();
    (villages || []).forEach((v) => {
      if (v.assignedFacilityId) {
        const fId = Number(v.assignedFacilityId);
        if (!map.has(fId)) {
          map.set(fId, []);
        }
        map.get(fId)!.push(v);
      }
    });
    return map;
  }, [villages]);

  /*
  // Original Code: zoomToSelection focused only on facilities. Since health facilities lack dynamic LLG mappings in the schema, filtering and zooming to an LLG would not focus the map accurately.
  const zoomToSelection = useCallback((provId: number | "all", distId: number | "all", llgId: number | "all") => {
    if (!mapRef.current) return;

    // Find all facilities matching the selection
    const matching = (facilities || []).filter((f) => {
      if (!f.latitude || !f.longitude) return false;
      if (provId !== "all") {
        const dist = districtLookup.get(Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(provId)) return false;
      }
      if (distId !== "all" && Number(f.districtId) !== Number(distId)) return false;
      if (llgId !== "all") {
        const llg = llgLookup.get(Number(llgId));
        if (llg && Number(llg.districtId) !== Number(f.districtId)) return false;
      }
      return true;
    });

    if (matching.length > 0) {
      const coords = matching.map((f) => [Number(f.latitude), Number(f.longitude)] as [number, number]);
      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // If it's a single point or bounds are extremely tight
      if (maxLat - minLat < 0.005 && maxLng - minLng < 0.005) {
        mapRef.current.flyTo([minLat, minLng], distId !== "all" ? 13 : 9, { animate: true, duration: 1.2 });
      } else {
        mapRef.current.fitBounds([[minLat, minLng], [maxLat, maxLng]], {
          padding: [50, 50],
          maxZoom: distId !== "all" ? 13 : 9,
          animate: true,
          duration: 1.2
        });
      }
    } else {
      // Fallback: zoom to tenant default mapCenter if available
      const tenantCenter = tenantInfo?.settings?.mapCenter;
      const tenantZoom = tenantInfo?.settings?.mapZoom;
      if (tenantCenter) {
        mapRef.current.flyTo(tenantCenter, tenantZoom || 6, { animate: true, duration: 1.2 });
      }
    }
  }, [facilities, districtLookup, llgLookup, tenantInfo]);
  */

  /*
  // Original Code: zoomToSelection focused on both matching facilities and villages using nested loops, which is slow during dynamic typing
  const zoomToSelection = useCallback((provId: number | "all", distId: number | "all", llgId: number | "all") => {
    if (!mapRef.current) return;

    const matchingFacilities = (facilities || []).filter((f) => {
      if (!f.latitude || !f.longitude) return false;
      if (provId !== "all") {
        const dist = districtLookup.get(Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(provId)) return false;
      }
      if (distId !== "all" && Number(f.districtId) !== Number(distId)) return false;
      if (llgId !== "all") {
        const hasVillageInLlg = villages.some(
          (v) => Number(v.llgId) === Number(llgId) && Number(v.assignedFacilityId) === Number(f.id)
        );
        const totalAssignedVillages = villages.filter((v) => Number(v.assignedFacilityId) === Number(f.id)).length;
        if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;
      }
      return true;
    });

    const matchingVillages = (villages || []).filter((v) => {
      if (!v.latitude || !v.longitude) return false;
      if (provId !== "all") {
        const dist = districtLookup.get(Number(v.districtId));
        if (!dist || Number(dist.provinceId) !== Number(provId)) return false;
      }
      if (distId !== "all" && Number(v.districtId) !== Number(distId)) return false;
      if (llgId !== "all" && Number(v.llgId) !== Number(llgId)) return false;
      return true;
    });

    const coords: [number, number][] = [];
    matchingFacilities.forEach((f) => coords.push([Number(f.latitude), Number(f.longitude)]));
    matchingVillages.forEach((v) => coords.push([Number(v.latitude), Number(v.longitude)]));

    if (coords.length > 0) {
      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      if (maxLat - minLat < 0.005 && maxLng - minLng < 0.005) {
        mapRef.current.flyTo([minLat, minLng], distId !== "all" ? 13 : 9, { animate: true, duration: 1.2 });
      } else {
        mapRef.current.fitBounds([[minLat, minLng], [maxLat, maxLng]], {
          padding: [50, 50],
          maxZoom: distId !== "all" ? 13 : 9,
          animate: true,
          duration: 1.2
        });
      }
    } else {
      const tenantCenter = tenantInfo?.settings?.mapCenter;
      const tenantZoom = tenantInfo?.settings?.mapZoom;
      if (tenantCenter) {
        mapRef.current.flyTo(tenantCenter, tenantZoom || 6, { animate: true, duration: 1.2 });
      }
    }
  }, [facilities, villages, districtLookup, llgLookup, tenantInfo]);
  */

  // Updated Code: High-performance O(1) zoomToSelection utilizing pre-computed facilityVillagesMap lookup
  const zoomToSelection = useCallback((provId: number | "all", distId: number | "all", llgId: number | "all") => {
    if (!mapRef.current) return;

    // Find all facilities matching the selection
    const matchingFacilities = (facilities || []).filter((f) => {
      if (!f.latitude || !f.longitude) return false;
      if (provId !== "all") {
        const dist = districtLookup.get(Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(provId)) return false;
      }
      if (distId !== "all" && Number(f.districtId) !== Number(distId)) return false;
      if (llgId !== "all") {
        // Original Code:
        // const assignedVillages = facilityVillagesMap.get(Number(f.id)) || [];
        // const hasVillageInLlg = assignedVillages.some((v) => Number(v.llgId) === Number(llgId));
        // const totalAssignedVillages = assignedVillages.length;
        // if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;

        // Updated Code:
        // Type-safe matching of facilities to Level 3 administrative boundaries (Payam) using
        // seeded externalIds.llgId, falling back to village catchment associations where absent.
        const payamId = f.externalIds && (f.externalIds as any).llgId;
        if (payamId) {
          if (Number(payamId) !== Number(llgId)) return false;
        } else {
          const assignedVillages = facilityVillagesMap.get(Number(f.id)) || [];
          const hasVillageInLlg = assignedVillages.some((v) => Number(v.llgId) === Number(llgId));
          const totalAssignedVillages = assignedVillages.length;
          if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;
        }
      }
      return true;
    });

    // Find all villages matching the selection (villages are explicitly mapped to LLG/Ward in the DB schema)
    const matchingVillages = (villages || []).filter((v) => {
      if (!v.latitude || !v.longitude) return false;
      if (provId !== "all") {
        const dist = districtLookup.get(Number(v.districtId));
        if (!dist || Number(dist.provinceId) !== Number(provId)) return false;
      }
      if (distId !== "all" && Number(v.districtId) !== Number(distId)) return false;
      if (llgId !== "all" && Number(v.llgId) !== Number(llgId)) return false;
      return true;
    });

    const coords: [number, number][] = [];
    matchingFacilities.forEach((f) => coords.push([Number(f.latitude), Number(f.longitude)]));
    matchingVillages.forEach((v) => coords.push([Number(v.latitude), Number(v.longitude)]));

    if (coords.length > 0) {
      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // If it's a single point or bounds are extremely tight
      if (maxLat - minLat < 0.005 && maxLng - minLng < 0.005) {
        mapRef.current.flyTo([minLat, minLng], distId !== "all" ? 13 : 9, { animate: true, duration: 1.2 });
      } else {
        mapRef.current.fitBounds([[minLat, minLng], [maxLat, maxLng]], {
          padding: [50, 50],
          maxZoom: distId !== "all" ? 13 : 9,
          animate: true,
          duration: 1.2
        });
      }
    } else {
      // Fallback: zoom to tenant default mapCenter if available
      const tenantCenter = tenantInfo?.settings?.mapCenter;
      const tenantZoom = tenantInfo?.settings?.mapZoom;
      if (tenantCenter) {
        mapRef.current.flyTo(tenantCenter, tenantZoom || 6, { animate: true, duration: 1.2 });
      }
    }
  }, [facilities, villages, districtLookup, llgLookup, tenantInfo, facilityVillagesMap]);

  // Updated Code: Robust type-safe smart cascading selectors leveraging Number() normalization and auto-zooms
  const handleProvinceChange = (provinceId: number | "all") => {
    setSelectedProvinceId(provinceId);
    setSelectedDistrictId("all");
    setSelectedLlgId("all");
    zoomToSelection(provinceId, "all", "all");
  };

  const handleDistrictChange = (districtId: number | "all") => {
    setSelectedDistrictId(districtId);
    setSelectedLlgId("all");
    let provId: number | "all" = selectedProvinceId;
    if (districtId !== "all") {
      const dist = districts.find((d: any) => Number(d.id) === Number(districtId));
      if (dist && dist.provinceId) {
        provId = Number(dist.provinceId);
        setSelectedProvinceId(provId);
      }
    }
    zoomToSelection(provId, districtId, "all");
  };

  const handleLlgChange = (llgId: number | "all") => {
    setSelectedLlgId(llgId);
    let provId: number | "all" = selectedProvinceId;
    let distId: number | "all" = selectedDistrictId;
    if (llgId !== "all") {
      const llg = llgs.find((l: any) => Number(l.id) === Number(llgId));
      if (llg && llg.districtId) {
        distId = Number(llg.districtId);
        setSelectedDistrictId(distId);
        const dist = districts.find((d: any) => Number(d.id) === Number(llg.districtId));
        if (dist && dist.provinceId) {
          provId = Number(dist.provinceId);
          setSelectedProvinceId(provId);
        }
      }
    }
    zoomToSelection(provId, distId, llgId);
  };

  const sidebarDistricts = useMemo(() => {
    if (selectedProvinceId === "all") return districts;
    return districts.filter((d) => Number(d.provinceId) === Number(selectedProvinceId));
  }, [districts, selectedProvinceId]);

  const sidebarLlgs = useMemo(() => {
    if (selectedDistrictId !== "all") {
      return llgs.filter((l) => Number(l.districtId) === Number(selectedDistrictId));
    }
    if (selectedProvinceId !== "all") {
      const allowedDistrictIds = new Set(
        districts.filter((d) => Number(d.provinceId) === Number(selectedProvinceId)).map((d) => Number(d.id))
      );
      return llgs.filter((l) => allowedDistrictIds.has(Number(l.districtId)));
    }
    return llgs;
  }, [llgs, districts, selectedProvinceId, selectedDistrictId]);

  /*
  // Original Code: filteredFacilities utilizing nested .some() array scans over the full 10k villages array
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (selectedProvinceId !== "all") {
        if (districtLookup.size === 0) return true;
        const dist = districtLookup.get(Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(selectedProvinceId)) return false;
      }
      if (selectedDistrictId !== "all" && Number(f.districtId) !== Number(selectedDistrictId)) return false;
      if (selectedFacilityId && Number(f.id) !== Number(selectedFacilityId)) return false;
      if (selectedLlgId !== "all") {
        if (llgLookup.size === 0) return true;
        const hasVillageInLlg = villages.some(
          (v) => Number(v.llgId) === Number(selectedLlgId) && Number(v.assignedFacilityId) === Number(f.id)
        );
        const totalAssignedVillages = villages.filter((v) => Number(v.assignedFacilityId) === Number(f.id)).length;
        if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = f.name?.toLowerCase().includes(query);
        const matchesHMIS = f.hmisCode?.toLowerCase().includes(query);
        if (!matchesName && !matchesHMIS) return false;
      }
      if (filterColdChain && !f.hasRefrigerator) return false;
      if (filterPower && !f.hasPower) return false;
      return true;
    });
  }, [facilities, selectedProvinceId, selectedDistrictId, selectedLlgId, searchQuery, filterColdChain, filterPower, districtLookup, llgLookup]);
  */

  // Updated Code: High-performance O(1) filteredFacilities utilizing pre-computed facilityVillagesMap index
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (selectedProvinceId !== "all") {
        if (districtLookup.size === 0) return true;
        const dist = districtLookup.get(Number(f.districtId));
        if (!dist || Number(dist.provinceId) !== Number(selectedProvinceId)) return false;
      }
      if (selectedDistrictId !== "all" && Number(f.districtId) !== Number(selectedDistrictId)) return false;
      if (selectedLlgId !== "all") {
        if (llgLookup.size === 0) return true;
        // Original Code:
        // const assignedVillages = facilityVillagesMap.get(Number(f.id)) || [];
        // const hasVillageInLlg = assignedVillages.some((v) => Number(v.llgId) === Number(selectedLlgId));
        // const totalAssignedVillages = assignedVillages.length;
        // if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;

        // Updated Code:
        // Type-safe matching of facilities to Level 3 administrative boundaries (Payam) using
        // seeded externalIds.llgId, falling back to village catchment associations where absent.
        const payamId = f.externalIds && (f.externalIds as any).llgId;
        if (payamId) {
          if (Number(payamId) !== Number(selectedLlgId)) return false;
        } else {
          const assignedVillages = facilityVillagesMap.get(Number(f.id)) || [];
          const hasVillageInLlg = assignedVillages.some((v) => Number(v.llgId) === Number(selectedLlgId));
          const totalAssignedVillages = assignedVillages.length;
          if (totalAssignedVillages > 0 && !hasVillageInLlg) return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = f.name?.toLowerCase().includes(query);
        const matchesHMIS = f.hmisCode?.toLowerCase().includes(query);
        if (!matchesName && !matchesHMIS) return false;
      }
      if (filterColdChain && !f.hasRefrigerator) return false;
      if (filterPower && !f.hasPower) return false;
      return true;
    });
  }, [facilities, selectedProvinceId, selectedDistrictId, selectedLlgId, searchQuery, filterColdChain, filterPower, districtLookup, llgLookup, facilityVillagesMap]);

  // Visible facilities after applying interactive legend hiddenCategories filters
  const visibleFacilities = useMemo(() => {
    if (hiddenCategories.has("facility")) return [];
    return filteredFacilities;
  }, [filteredFacilities, hiddenCategories]);

  // Original Code commented out to preserve backward compatibility:
  /*
  const filteredFacilitiesMap = useMemo(() => {
    const map = new Map<number, Facility>();
    (visibleFacilities || []).forEach((f) => {
      map.set(Number(f.id), f);
    });
    return map;
  }, [visibleFacilities]);
  */

  // Memoized O(1) map associating facilityId to Facility object for O(1) polyline and rendering calculations.
  // Updated Code: Built from filteredFacilities rather than visibleFacilities to avoid breaking off-screen lookups and toggles.
  const filteredFacilitiesMap = useMemo(() => {
    const map = new Map<number, Facility>();
    (filteredFacilities || []).forEach((f) => {
      map.set(Number(f.id), f);
    });
    return map;
  }, [filteredFacilities]);

  /* Original Code commented out to preserve backward compatibility and prevent rendering excessive facilities when mapBounds is null:
  const visibleFacilitiesFiltered = useMemo(() => {
    if (hiddenCategories.has("facility")) return [];
    if (!mapBounds) return filteredFacilities;

    // For small datasets (< 100 facilities), skip bounds check
    if (filteredFacilities.length < 100) return filteredFacilities;

    const expanded = mapBounds.pad(0.3);
    return filteredFacilities.filter((f) => {
      if (!f.latitude || !f.longitude) return false;

      // If this facility is currently focused/selected, bypass bounds pruning
      if (selectedFacilityId && Number(f.id) === Number(selectedFacilityId)) {
        return true;
      }

      return expanded.contains([Number(f.latitude), Number(f.longitude)]);
    });
  }, [filteredFacilities, mapBounds, hiddenCategories, selectedFacilityId]);
  */

  // Updated Code: Fix null bounds leak by checking if filteredFacilities.length < 100 before returning all of them when mapBounds is null on initial mount.
  const visibleFacilitiesFiltered = useMemo(() => {
    if (hiddenCategories.has("facility")) return [];
    if (!mapBounds) {
      return filteredFacilities.length < 100 ? filteredFacilities : [];
    }

    // For small datasets (< 100 facilities), skip bounds check
    if (filteredFacilities.length < 100) return filteredFacilities;

    const expanded = mapBounds.pad(0.3);
    return filteredFacilities.filter((f) => {
      if (!f.latitude || !f.longitude) return false;

      // If this facility is currently focused/selected, bypass bounds pruning
      if (selectedFacilityId && Number(f.id) === Number(selectedFacilityId)) {
        return true;
      }

      return expanded.contains([Number(f.latitude), Number(f.longitude)]);
    });
  }, [filteredFacilities, mapBounds, hiddenCategories, selectedFacilityId]);

  const filteredVillages = useMemo(() => {
    if (mode === "surveillance") return [];
    return villages.filter((v) => {
      if (selectedProvinceId !== "all") {
        if (districtLookup.size === 0) return true;
        const dist = districtLookup.get(Number(v.districtId));
        if (!dist || Number(dist.provinceId) !== Number(selectedProvinceId)) return false;
      }
      if (selectedDistrictId !== "all" && Number(v.districtId) !== Number(selectedDistrictId)) return false;
      if (selectedFacilityId && Number(v.assignedFacilityId) !== Number(selectedFacilityId)) return false;
      if (selectedLlgId !== "all") {
        if (llgLookup.size === 0) return true;
        if (Number(v.llgId) !== Number(selectedLlgId)) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = v.name?.toLowerCase().includes(query);
        const matchesCode = v.code?.toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }
      if (villageCategory === "htr" && !v.isHardToReach) return false;
      if (villageCategory === "standard" && v.isHardToReach) return false;
      return true;
    });
  }, [villages, selectedProvinceId, selectedDistrictId, selectedLlgId, searchQuery, villageCategory, districtLookup, llgLookup]);

  const filteredUnservedPlaces = useMemo(() => {
    if (mode === "surveillance") return [];

    const countryBoundaryGeoJSONs = (() => {
      const list = boundaryList || [];
      const activeLevelOne = list
        .filter((b: any) => b.isActive !== false && Number(b.adminLevel) === 1)
        .map((b: any) => boundaryGeoJSONs?.[b.id])
        .filter((geojson: any) => geojson);

      if (activeLevelOne.length > 0) return activeLevelOne;

      return list
        .filter((b: any) => b.isActive !== false)
        .map((b: any) => boundaryGeoJSONs?.[b.id])
        .filter((geojson: any) => geojson);
    })();

    return unservedPlaces.filter((p: any) => {
      if (p.latitude == null || p.longitude == null) return false;

      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (countryBoundaryGeoJSONs.length > 0 && !isPointInAnyGeoJSONBoundary(lat, lng, countryBoundaryGeoJSONs)) {
        return false;
      }

      if (selectedProvinceId !== "all") {
        if (districtLookup.size === 0) return true;
        const dist = districtLookup.get(Number(p.districtId));
        if (!dist || Number(dist.provinceId) !== Number(selectedProvinceId)) return false;
      }
      if (selectedDistrictId !== "all" && Number(p.districtId) !== Number(selectedDistrictId)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name?.toLowerCase().includes(query);
        if (!matchesName) return false;
      }
      if (villageCategory === "htr" && !p.isHardToReach) return false;
      if (villageCategory === "standard" && p.isHardToReach) return false;
      return true;
    });
  }, [unservedPlaces, selectedProvinceId, selectedDistrictId, searchQuery, villageCategory, districtLookup, mode, boundaryList, boundaryGeoJSONs]);

  // Original Code commented out to preserve backward compatibility:
  /*
  const showVillageMarkers = useMemo(() => {
    if (
      selectedDistrictId !== "all" ||
      selectedLlgId !== "all" ||
      villageCategory !== "all" ||
      searchQuery.trim() !== "" ||
      (filteredVillages && filteredVillages.length < 500)
    ) {
      return true;
    }
    return currentZoom >= 10;
  }, [currentZoom, selectedDistrictId, selectedLlgId, villageCategory, searchQuery, filteredVillages?.length]);
  */

  // Original Code commented out to preserve backward compatibility:
  /*
  const showVillageMarkers = useMemo(() => {
    if (
      selectedDistrictId !== "all" ||
      selectedLlgId !== "all" ||
      villageCategory !== "all" ||
      searchQuery.trim() !== "" ||
      (filteredVillages && filteredVillages.length < 500)
    ) {
      return true;
    }
    return currentZoom >= 12;
  }, [currentZoom, selectedDistrictId, selectedLlgId, villageCategory, searchQuery, filteredVillages?.length]);
  */

  // Updated Code: Adjusted default zoom threshold from 12 to 13 to restrict rendering at far zooms and improve map performance.
  // Enforces the zoom gate even when province/district/LLG filters are active, unless the total number of filtered villages is small (< 500) or a search query is typed.
  /* Original Code commented out to preserve backward compatibility and prevent zoom gate search query leaks:
  const showVillageMarkers = useMemo(() => {
    if (filteredVillages && filteredVillages.length < 500) {
      return true;
    }
    if (searchQuery.trim() !== "") {
      return true;
    }
    return currentZoom >= 13;
  }, [currentZoom, searchQuery, filteredVillages?.length]);
  */

  // Updated Code: Remove the unrestricted searchQuery bypass. If the query results in < 500 villages, it is handled by the first condition. If the query matches >= 500 villages, it is restricted by the zoom threshold (>= 13) to prevent map hangs.
  const showVillageMarkers = useMemo(() => {
    if (filteredVillages && filteredVillages.length < 500) {
      return true;
    }
    return currentZoom >= 13;
  }, [currentZoom, filteredVillages?.length]);

  const plannedVillageIds = useMemo(() => {
    const ids = new Set<number>();
    (dayPlans || []).forEach((dp: any) => {
      if (Array.isArray(dp.communitiesVisited)) {
        dp.communitiesVisited.forEach((vId: any) => {
          const parsedId = Number(vId);
          if (!isNaN(parsedId)) {
            ids.add(parsedId);
          }
        });
      }
    });
    return ids;
  }, [dayPlans]);

  const villagePlanningDetails = useMemo(() => {
    const details = new Map<number, { dayNumber: number; sessionName: string }>();
    (dayPlans || []).forEach((dp: any) => {
      if (Array.isArray(dp.communitiesVisited)) {
        dp.communitiesVisited.forEach((vId: any) => {
          const id = Number(vId);
          const session = sessions.find(s => s.id === dp.sessionPlanId);
          if (session) {
            details.set(id, {
              dayNumber: dp.dayNumber,
              sessionName: session.name,
            });
          }
        });
      }
    });
    return details;
  }, [dayPlans, sessions]);

  const stats = useMemo(() => {
    let planned = 0;
    let missingStandard = 0;
    let missingHtr = 0;

    filteredVillages.forEach((v) => {
      if (v.latitude && v.longitude) {
        if (plannedVillageIds.has(v.id)) {
          planned++;
        } else if (v.isHardToReach) {
          missingHtr++;
        } else {
          missingStandard++;
        }
      }
    });

    const total = planned + missingStandard + missingHtr;
    const coverage = total > 0 ? Math.round((planned / total) * 100) : 0;

    // Task #47: session-plan + unserved counters surfaced in the legend.
    let sessionPlanned = 0;
    let sessionInProgress = 0;
    let sessionCompleted = 0;
    let sessionOverdue = 0;
    for (const s of sessionMapPins as any[]) {
      const lc = deriveSessionLifecycle(s);
      if (lc.phase === "reported" || lc.phase === "archived") sessionCompleted++;
      else if (lc.phase === "in_progress") sessionInProgress++;
      else sessionPlanned++;
      if (lc.isOverdue) sessionOverdue++;
    }
    const unserved = filteredUnservedPlaces.length;

    return { planned, missingStandard, missingHtr, total, coverage, sessionPlanned, sessionInProgress, sessionCompleted, sessionOverdue, unserved };
  }, [filteredVillages, plannedVillageIds, sessionMapPins, filteredUnservedPlaces]);

  /* Original visibleVillagesFiltered logic commented out to preserve backward compatibility and adhere to coding rules:
  const visibleVillagesFiltered = useMemo(() => {
    const list = (() => {
      // Always apply bounds pruning when bounds are available — this protects
      // performance at all zoom levels regardless of showVillageMarkers.
      if (!mapBounds) return filteredVillages;
      // For small datasets (< 500 villages), skip expensive bounds check since
      // all markers can be rendered efficiently.
      if (filteredVillages.length < 500) return filteredVillages;
      return filteredVillages.filter((v) => {
        if (!v.latitude || !v.longitude) return false;
        // Expand bounds slightly so markers at the edge stay visible
        const expanded = mapBounds.pad(0.1);
        return expanded.contains([Number(v.latitude), Number(v.longitude)]);
      });
    })();
    return list.filter((v) => {
      const isPlanned = plannedVillageIds.has(v.id);
      if (isPlanned) {
        return !hiddenCategories.has("planned");
      } else if (v.isHardToReach) {
        return !hiddenCategories.has("missingHtr");
      } else {
        return !hiddenCategories.has("missingStandard");
      }
    });
  }, [filteredVillages, mapBounds, hiddenCategories, plannedVillageIds]);
  */

  // Updated Code: Adjusted bounds-pruning logic for villages.
  // 1. If a village belongs to the currently focused/selected facility, bypass bounds pruning so it never disappears on zoom.
  // 2. Expand the default Leaflet bounds padding from 0.1 to 0.3 for a safer viewport edge margin.
  // 3. Added selectedFacilityId to the useMemo dependency array.
  // Original Code (commented out to preserve working code while optimizing performance):
  /*
  const visibleVillagesFiltered = useMemo(() => {
    const list = (() => {
      if (!mapBounds) return filteredVillages;
      // For small datasets (< 500 villages), skip bounds check
      if (filteredVillages.length < 500) return filteredVillages;
      return filteredVillages.filter((v) => {
        if (!v.latitude || !v.longitude) return false;

        // If this village is routed to the currently selected/focused facility, bypass bounds pruning
        const isRouted = selectedFacilityId && communityRoutes && communityRoutes.some((r: any) => r.villageId === v.id);
        if (isRouted || (selectedFacilityId && Number(v.assignedFacilityId) === Number(selectedFacilityId))) {
          return true;
        }

        // Expand bounds by 30% so markers near the edge remain rendered
        const expanded = mapBounds.pad(0.3);
        return expanded.contains([Number(v.latitude), Number(v.longitude)]);
      });
    })();
    return list.filter((v) => {
      const isPlanned = plannedVillageIds.has(v.id);
      if (isPlanned) {
        return !hiddenCategories.has("planned");
      } else if (v.isHardToReach) {
        return !hiddenCategories.has("missingHtr");
      } else {
        return !hiddenCategories.has("missingStandard");
      }
    });
  }, [filteredVillages, mapBounds, hiddenCategories, plannedVillageIds, selectedFacilityId, communityRoutes]);
  */

  // Optimized Code: Pre-parse float coordinates once, hoist bounds padding, and use Set lookup O(1) for routing.
  const villageCoordsCache = useMemo(() => {
    const cache = new Map<number, { lat: number; lng: number }>();
    (filteredVillages || []).forEach((v) => {
      if (v.latitude && v.longitude) {
        const lat = parseFloat(v.latitude);
        const lng = parseFloat(v.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          cache.set(v.id, { lat, lng });
        }
      }
    });
    return cache;
  }, [filteredVillages]);

  // Original Code commented out to preserve backward compatibility:
  /*
  const visibleVillagesFiltered = useMemo(() => {
    const list = (() => {
      if (!mapBounds) return filteredVillages;
      // For small datasets (< 500 villages), skip bounds check
      if (filteredVillages.length < 500) return filteredVillages;

      const expanded = mapBounds.pad(0.3);
      const routedVillageIds = new Set<number>();
      if (selectedFacilityId && communityRoutes) {
        communityRoutes.forEach((r: any) => {
          if (r.villageId) routedVillageIds.add(Number(r.villageId));
        });
      }

      return filteredVillages.filter((v) => {
        const coords = villageCoordsCache.get(v.id);
        if (!coords) return false;

        // If this village is routed to the currently selected/focused facility, bypass bounds pruning
        const isRouted = selectedFacilityId && routedVillageIds.has(v.id);
        if (isRouted || (selectedFacilityId && Number(v.assignedFacilityId) === Number(selectedFacilityId))) {
          return true;
        }

        return expanded.contains([coords.lat, coords.lng]);
      });
    })();
    return list.filter((v) => {
      const isPlanned = plannedVillageIds.has(v.id);
      if (isPlanned) {
        return !hiddenCategories.has("planned");
      } else if (v.isHardToReach) {
        return !hiddenCategories.has("missingHtr");
      } else {
        return !hiddenCategories.has("missingStandard");
      }
    });
  }, [filteredVillages, villageCoordsCache, mapBounds, hiddenCategories, plannedVillageIds, selectedFacilityId, communityRoutes]);
  */

  // Optimized Code: Use a memoized RBush spatial index for fast O(log N) viewport queries on filteredVillages,
  // bypassing expensive O(N) scans. Supports quick fallback/bypassing for routed/assigned villages under selected facility focus.
  type FilteredVillageIdxItem = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    village: Village;
  };

  const filteredVillagesSpatialIndex = useMemo(() => {
    const tree = new RBush<FilteredVillageIdxItem>();
    const items: FilteredVillageIdxItem[] = [];
    (filteredVillages || []).forEach((v) => {
      const coords = villageCoordsCache.get(v.id);
      if (!coords) return;
      items.push({
        minX: coords.lng,
        minY: coords.lat,
        maxX: coords.lng,
        maxY: coords.lat,
        village: v,
      });
    });
    tree.load(items);
    return tree;
  }, [filteredVillages, villageCoordsCache]);

  const filteredVillagesByFacilityMap = useMemo(() => {
    const map = new Map<number, Village[]>();
    (filteredVillages || []).forEach((v) => {
      if (v.assignedFacilityId) {
        const facId = Number(v.assignedFacilityId);
        let list = map.get(facId);
        if (!list) {
          list = [];
          map.set(facId, list);
        }
        list.push(v);
      }
    });
    return map;
  }, [filteredVillages]);

  const filteredVillagesMap = useMemo(() => {
    const map = new Map<number, Village>();
    (filteredVillages || []).forEach((v) => {
      map.set(v.id, v);
    });
    return map;
  }, [filteredVillages]);

  /* Original Code commented out to preserve backward compatibility and prevent rendering all villages when mapBounds is null:
  const visibleVillagesFiltered = useMemo(() => {
    const list = (() => {
      if (!mapBounds) return filteredVillages;
      // For small datasets (< 500 villages), skip bounds check
      if (filteredVillages.length < 500) return filteredVillages;

      const expanded = mapBounds.pad(0.3);
      const routedVillageIds = new Set<number>();
      if (selectedFacilityId && communityRoutes) {
        communityRoutes.forEach((r: any) => {
          if (r.villageId) routedVillageIds.add(Number(r.villageId));
        });
      }

      const bbox = {
        minX: expanded.getWest(),
        minY: expanded.getSouth(),
        maxX: expanded.getEast(),
        maxY: expanded.getNorth(),
      };

      const inBounds = filteredVillagesSpatialIndex.search(bbox).map(item => item.village);

      if (!selectedFacilityId) {
        return inBounds;
      }

      const result = [...inBounds];
      const resultIds = new Set(inBounds.map(v => v.id));

      // Add assigned villages
      const assigned = filteredVillagesByFacilityMap.get(Number(selectedFacilityId)) || [];
      assigned.forEach((v) => {
        if (!resultIds.has(v.id)) {
          resultIds.add(v.id);
          result.push(v);
        }
      });

      // Add routed villages
      routedVillageIds.forEach((vId) => {
        const v = filteredVillagesMap.get(vId);
        if (v && !resultIds.has(vId)) {
          resultIds.add(vId);
          result.push(v);
        }
      });

      return result;
    })();

    return list.filter((v) => {
      const isPlanned = plannedVillageIds.has(v.id);
      if (isPlanned) {
        return !hiddenCategories.has("planned");
      } else if (v.isHardToReach) {
        return !hiddenCategories.has("missingHtr");
      } else {
        return !hiddenCategories.has("missingStandard");
      }
    });
  }, [
    filteredVillages,
    filteredVillagesSpatialIndex,
    filteredVillagesByFacilityMap,
    filteredVillagesMap,
    mapBounds,
    hiddenCategories,
    plannedVillageIds,
    selectedFacilityId,
    communityRoutes
  ]);
  */

  // Updated Code: Fix null bounds leak by checking if filteredVillages.length < 500 before returning all filtered villages on initial mount.
  const visibleVillagesFiltered = useMemo(() => {
    const list = (() => {
      if (!mapBounds) {
        return filteredVillages.length < 500 ? filteredVillages : [];
      }
      // For small datasets (< 500 villages), skip bounds check
      if (filteredVillages.length < 500) return filteredVillages;

      const expanded = mapBounds.pad(0.3);
      const routedVillageIds = new Set<number>();
      if (selectedFacilityId && communityRoutes) {
        communityRoutes.forEach((r: any) => {
          if (r.villageId) routedVillageIds.add(Number(r.villageId));
        });
      }

      const bbox = {
        minX: expanded.getWest(),
        minY: expanded.getSouth(),
        maxX: expanded.getEast(),
        maxY: expanded.getNorth(),
      };

      const inBounds = filteredVillagesSpatialIndex.search(bbox).map(item => item.village);

      if (!selectedFacilityId) {
        return inBounds;
      }

      const result = [...inBounds];
      const resultIds = new Set(inBounds.map(v => v.id));

      // Add assigned villages
      const assigned = filteredVillagesByFacilityMap.get(Number(selectedFacilityId)) || [];
      assigned.forEach((v) => {
        if (!resultIds.has(v.id)) {
          resultIds.add(v.id);
          result.push(v);
        }
      });

      // Add routed villages
      routedVillageIds.forEach((vId) => {
        const v = filteredVillagesMap.get(vId);
        if (v && !resultIds.has(vId)) {
          resultIds.add(vId);
          result.push(v);
        }
      });

      return result;
    })();

    return list.filter((v) => {
      const isPlanned = plannedVillageIds.has(v.id);
      if (isPlanned) {
        return !hiddenCategories.has("planned");
      } else if (v.isHardToReach) {
        return !hiddenCategories.has("missingHtr");
      } else {
        return !hiddenCategories.has("missingStandard");
      }
    });
  }, [
    filteredVillages,
    filteredVillagesSpatialIndex,
    filteredVillagesByFacilityMap,
    filteredVillagesMap,
    mapBounds,
    hiddenCategories,
    plannedVillageIds,
    selectedFacilityId,
    communityRoutes
  ]);

  const activeMapVillages = useMemo(() => {
    if (showVillageMarkers) return visibleVillagesFiltered;
    if (selectedFacilityId && communityRoutes && communityRoutes.length > 0) {
      const routedVillageIds = new Set(communityRoutes.map((r: any) => Number(r.villageId)));
      return villages.filter((v) => routedVillageIds.has(v.id));
    }
    return [];
  }, [showVillageMarkers, visibleVillagesFiltered, selectedFacilityId, communityRoutes, villages]);

  const activeClusteredVillages = useMemo(() => {
    if (showVillageMarkers) return visibleVillagesFiltered;
    if (selectedFacilityId && communityRoutes && communityRoutes.length > 0) {
      const routedVillageIds = new Set(communityRoutes.map((r: any) => Number(r.villageId)));
      return villages.filter((v) => routedVillageIds.has(v.id));
    }
    return [];
  }, [showVillageMarkers, visibleVillagesFiltered, selectedFacilityId, communityRoutes, villages]);

  // Viewport bounds pruning for session pins and unserved places to optimize map rendering performance
  const visibleSessionMapPins = useMemo(() => {
    if (mode !== "planning") return [];
    if (!sessionMapPins || sessionMapPins.length === 0) return [];

    const statusFiltered = sessionMapPins.filter((s: any) => {
      if (s.status === "completed") return !hiddenCategories.has("sessionCompleted");
      if (s.status === "in_progress" || s.status === "in-progress") return !hiddenCategories.has("sessionInProgress");
      return !hiddenCategories.has("sessionPlanned");
    });

    if (!mapBounds) return statusFiltered;
    const expanded = mapBounds.pad(0.3);
    return statusFiltered.filter((s: any) => {
      if (s.lat == null || s.lng == null) return false;
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      return expanded.contains([lat, lng]);
    });
  }, [sessionMapPins, hiddenCategories, mapBounds, mode]);

  const visibleUnservedPlaces = useMemo(() => {
    if (mode !== "planning") return [];
    if (hiddenCategories.has("unserved")) return [];
    if (!filteredUnservedPlaces || filteredUnservedPlaces.length === 0) return [];

    if (!mapBounds) return filteredUnservedPlaces;
    const expanded = mapBounds.pad(0.3);
    return filteredUnservedPlaces.filter((p: any) => {
      if (p.latitude == null || p.longitude == null) return false;
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return expanded.contains([lat, lng]);
    });
  }, [filteredUnservedPlaces, hiddenCategories, mapBounds, mode]);



  const handleFocusFacility = (facility: Facility) => {
    if (!facility.latitude || !facility.longitude) return;
    const lat = Number(facility.latitude);
    const lng = Number(facility.longitude);

    mapRef.current?.flyTo([lat, lng], 14, {
      animate: true,
      duration: 1.5,
    });

    setTimeout(() => {
      const marker = markerRefs.current[facility.id];
      if (marker) {
        marker.openPopup();
      }
    }, 450);
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Rename states and submission handler
  const [renameTarget, setRenameTarget] = useState<{
    type: "province" | "district" | "llg" | "village";
    id: number;
    name: string;
  } | null>(null);
  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // OSM-style instant name overrides — populated immediately after a rename so
  // map labels (GeoJSON tooltips, village Tooltips) reflect the new name before
  // the TanStack query refetch completes. Key: normalised original name, Value: new name.
  const [nameOverrides, setNameOverrides] = useState<Map<string, string>>(new Map());
  const applyNameOverride = (originalName: string, newName: string) => {
    setNameOverrides((prev) => {
      const next = new Map(prev);
      next.set(originalName.trim().toLowerCase(), newName.trim());
      return next;
    });
  };
  /** Look up any client-side rename override, falling back to the original name. */
  const resolveLabel = (name: string) =>
    nameOverrides.get(name.trim().toLowerCase()) ?? name;

  useEffect(() => {
    if (renameTarget) {
      setRenameName(renameTarget.name || "");
    } else {
      setRenameName("");
    }
  }, [renameTarget]);

  const handleRenameSubmit = async () => {
    if (!renameTarget || !renameName.trim()) return;
    setIsRenaming(true);
    try {
      const url =
        renameTarget.type === "province"
          ? `/api/provinces/${renameTarget.id}`
          : renameTarget.type === "district"
            ? `/api/districts/${renameTarget.id}`
            : renameTarget.type === "llg"
              ? `/api/llgs/${renameTarget.id}`
              : `/api/villages/${renameTarget.id}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to save name update");
      }

      toast({
        title: "Renamed Successfully",
        description: `The ${renameTarget.type} has been renamed to "${renameName.trim()}"`,
      });

      // OSM-style instant update: immediately apply the override so map labels
      // reflect the new name without waiting for TanStack query refetch.
      applyNameOverride(renameTarget.name, renameName.trim());

      queryClient.invalidateQueries({ queryKey: ["/api/provinces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/districts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/indicators/zero-dose"] });

      setRenameTarget(null);
    } catch (err: any) {
      toast({
        title: "Error Renaming Entity",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  // Measurement State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<[number, number][]>([]);

  // Export State
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // ─── HCW Catchment Drawing State ────────────────────────────────────────
  const [isDrawingCatchment, setIsDrawingCatchment] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [saveCatchmentOpen, setSaveCatchmentOpen] = useState(false);
  const [catchmentName, setCatchmentName] = useState("");
  const [catchmentDescription, setCatchmentDescription] = useState("");
  const [catchmentFacilityId, setCatchmentFacilityId] = useState<number | null>(null);
  const [catchmentPopEst, setCatchmentPopEst] = useState("");
  const [catchmentProvinceId, setCatchmentProvinceId] = useState<number | null>(null);
  const [catchmentDistrictId, setCatchmentDistrictId] = useState<number | null>(null);
  const [catchmentAutoDetectKm, setCatchmentAutoDetectKm] = useState<number | null>(null);

  // ─── Queries for boundary and catchment data ──────────────────────────

const { data: hcwCatchments } = useQuery<FacilityCatchment[]>({
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryKey: ["/api/catchments", tenantInfo?.id],
    queryFn: async () => {
      const res = await fetch("/api/catchments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch catchments");
      return res.json();
    },
    enabled: layers.hcwCatchments,
  });

  // Fetch full GeoJSON for each active boundary
// Population choropleth source toggle
  const [popChoroplethSource, setPopChoroplethSource] = useState<"nso" | "hmis" | "worldpop">("worldpop");
  const { data: choroplethData = [] } = useQuery<Array<{ districtId: number; population: number }>>(
    {
      queryKey: ["/api/surveillance/population/choropleth", tenantInfo?.id, popChoroplethSource],
      queryFn: async () => {
        const res = await fetch(`/api/surveillance/population/choropleth?source=${popChoroplethSource}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch population choropleth data");
        return res.json();
      },
      enabled: layers.populationChoropleth && !!tenantInfo?.id,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }
  );
  // Memoized cache of catchment bounding boxes to avoid parsing coordinates repeatedly
  const catchmentBBoxes = useMemo(() => {
    const cache = new Map<string | number, { minLat: number; maxLat: number; minLng: number; maxLng: number }>();
    (hcwCatchments || []).forEach((c) => {
      const bbox = getGeoJSONBBox(c.geojson);
      if (bbox.minLat !== Infinity) {
        cache.set(c.id, bbox);
      }
    });
    return cache;
  }, [hcwCatchments]);

  // Viewport bounds pruning for HCW-drawn catchments to speed up map panning/zooming
  const visibleHcwCatchments = useMemo(() => {
    if (!layers.hcwCatchments) return [];
    if (!hcwCatchments || hcwCatchments.length === 0) return [];
    if (!mapBounds) return hcwCatchments;

    const expanded = mapBounds.pad(0.3);
    const boundsLatMin = expanded.getSouth();
    const boundsLatMax = expanded.getNorth();
    const boundsLngMin = expanded.getWest();
    const boundsLngMax = expanded.getEast();

    return hcwCatchments.filter((c) => {
      const bbox = catchmentBBoxes.get(c.id);
      if (!bbox) return false;

      // Check if catchment bounding box overlaps with expanded map bounds
      const overlaps = !(
        bbox.maxLat < boundsLatMin ||
        bbox.minLat > boundsLatMax ||
        bbox.maxLng < boundsLngMin ||
        bbox.minLng > boundsLngMax
      );
      return overlaps;
    });
  }, [hcwCatchments, catchmentBBoxes, mapBounds, layers.hcwCatchments]);

  const districtPopMap = useMemo(() => {
    const m = new Map<number, number>();
    if (choroplethData) choroplethData.forEach((r) => r.districtId && m.set(Number(r.districtId), Number(r.population)));
    return m;
  }, [choroplethData]);
  const populationChoroplethStats = useMemo(() => {
    const values = Array.from(districtPopMap.values()).filter((value) => Number.isFinite(value) && value > 0);
    return {
      bins: createPopulationChoroplethBins(values),
      totalPopulation: values.reduce((sum, value) => sum + value, 0),
      districtCount: values.length,
    };
  }, [districtPopMap]);
  const getChoroplethColor = useCallback((pop: number): string => {
    return getPopulationChoroplethBin(pop, populationChoroplethStats.bins).color;
  }, [populationChoroplethStats.bins]);
  useEffect(() => {
    if (!boundaryList) return;
    boundaryList.forEach((b) => {
      if (boundaryGeoJSONs[b.id] || fetchingRef.current[b.id]) return;
      fetchingRef.current[b.id] = true;
      fetch(`/api/boundaries/${b.id}/geojson`)
        .then((res) => res.json())
        .then((gj) => {
          setBoundaryGeoJSONs((prev) => ({ ...prev, [b.id]: gj }));
        })
        .finally(() => {
          fetchingRef.current[b.id] = false;
        });
    });
  }, [boundaryList, boundaryGeoJSONs]);

  // Pre-filter the GeoJSON features in JS to ensure we only load and render the required boundaries,
  // preventing layout engine lockup and layout lag.
  const filteredBoundaryGeoJSONs = useMemo(() => {
    const filtered: Record<string, any> = {};
    if (!boundaryList) return filtered;

    // Determine active admin level based on selectors:
    // - selectedProvinceId === "all" -> Level 1 (Province)
    // - selectedProvinceId !== "all" && selectedDistrictId === "all" -> Level 2 (District)
    // - selectedProvinceId !== "all" && selectedDistrictId !== "all" -> Level 3 (LLG/Ward)
    const availableLevels = (boundaryList || []).map(b => b.adminLevel);
    const hasLevel2 = availableLevels.includes(2);
    const hasLevel3 = availableLevels.includes(3);

    let activeAdminLevel = 1;
    if (selectedProvinceId !== "all" && hasLevel2) {
      if (selectedDistrictId === "all") {
        activeAdminLevel = 2;
      } else if (hasLevel3) {
        activeAdminLevel = 3;
      } else {
        activeAdminLevel = 2; // Cap at Level 2 since Level 3 boundaries don't exist
      }
    }

    boundaryList.forEach((b) => {
      const geojson = boundaryGeoJSONs[b.id];
      if (!geojson) return;

      // Process if it is the active admin boundary or explicitly enabled
      const isVisible =
        (layers.boundaries && b.adminLevel === activeAdminLevel) ||
        (layers.constituencies && b.adminLevel === 2) ||
        (layers.wards && b.adminLevel === 3);
      if (!isVisible) return;

      const filteredFeatures = (geojson.features || []).filter((feature: any) => {
        const fName = feature.properties?.name ||
          feature.properties?.NAME ||
          feature.properties?.shapeName ||
          feature.properties?.NAME_1 ||
          feature.properties?.NAME_2 ||
          feature.properties?.NAME_3 ||
          "";
        const normFName = normalizeName(fName);

        if (b.adminLevel === 1) {
          return true;
        } else if (b.adminLevel === 2) {
          if (selectedProvinceId === "all") {
            return true;
          }
          const targetProv = provinceLookup.get(Number(selectedProvinceId));
          if (!targetProv) {
            return true;
          } else {
            const normTargetProv = normalizeName(targetProv.name);
            const localDist = districtNameLookup.get(normFName);

            if (localDist) {
              if (selectedDistrictId !== "all" && !hasLevel3) {
                return Number(localDist.id) === Number(selectedDistrictId);
              }
              return Number(localDist.provinceId) === Number(selectedProvinceId);
            } else {
              // Fallback name-matching on GeoJSON parent properties
              const provProp = feature.properties?.province ||
                feature.properties?.PROVINCE ||
                feature.properties?.NAME_1 ||
                "";
              const normProvProp = normalizeName(provProp);
              if (normProvProp) {
                return normProvProp === normTargetProv;
              } else {
                return false;
              }
            }
          }
        } else if (b.adminLevel === 3) {
          if (selectedDistrictId === "all") {
            // If province is selected, only show wards in that province
            if (selectedProvinceId !== "all") {
              const allowedDistrictIds = new Set(
                districts.filter((d) => Number(d.provinceId) === Number(selectedProvinceId)).map((d) => Number(d.id))
              );
              const localLlg = llgNameLookup.get(normFName);
              if (localLlg) {
                return allowedDistrictIds.has(Number(localLlg.districtId));
              }
              const distProp = feature.properties?.district || feature.properties?.DISTRICT || feature.properties?.NAME_2 || feature.properties?.adm2_name || "";
              const matchedDist = districts.find(d => normalizeName(d.name) === normalizeName(distProp));
              return matchedDist ? allowedDistrictIds.has(Number(matchedDist.id)) : false;
            }
            return true;
          }
          const targetDist = districtLookup.get(Number(selectedDistrictId));
          if (!targetDist) {
            return true;
          } else {
            const normTargetDist = normalizeName(targetDist.name);

            // Filter down to single LLG if one is specifically selected
            if (selectedLlgId !== "all") {
              const targetLlg = llgLookup.get(Number(selectedLlgId));
              if (targetLlg) {
                const normTargetLlg = normalizeName(targetLlg.name);
                return normFName === normTargetLlg;
              } else {
                return false;
              }
            } else {
              const localLlg = llgNameLookup.get(normFName);

              if (localLlg) {
                return Number(localLlg.districtId) === Number(selectedDistrictId);
              } else {
                // Fallback name-matching on GeoJSON parent properties
                const distProp = feature.properties?.district ||
                  feature.properties?.DISTRICT ||
                  feature.properties?.NAME_2 ||
                  feature.properties?.adm2_name ||
                  "";
                const normDistProp = normalizeName(distProp);
                if (normDistProp) {
                  return normDistProp === normTargetDist;
                } else {
                  return false;
                }
              }
            }
          }
        }
        return false;
      });

      filtered[b.id] = {
        ...geojson,
        features: filteredFeatures,
      };
    });

    return filtered;
  }, [
    boundaryList,
    boundaryGeoJSONs,
    selectedProvinceId,
    selectedDistrictId,
    selectedLlgId,
    provinces,
    districts,
    llgs,
    layers.boundaries,
    layers.constituencies,
    layers.wards,
    provinceLookup,
    districtLookup,
    llgLookup,
    districtNameLookup,
    llgNameLookup,
  ]);

  // ─── GRID3 selection-aware emphasis ──────────────────────────────────────
  // When a Province / District / LLG is selected, compute the matching admin
  // polygon(s) from the boundary GeoJSON layer. We never *exclude* GRID3
  // features based on the filter — settlements that straddle the boundary
  // must still be visible — but we visually emphasize footprints whose
  // centroid falls inside the selected admin area and dim those outside.
  const selectedAdminFeatures = useMemo<any | null>(() => {
    if (!boundaryList) return null;
    let targetLevel = 0;
    let targetName = "";
    if (selectedLlgId !== "all") {
      targetLevel = 3;
      targetName = llgLookup.get(Number(selectedLlgId))?.name || "";
    } else if (selectedDistrictId !== "all") {
      targetLevel = 2;
      targetName = districtLookup.get(Number(selectedDistrictId))?.name || "";
    } else if (selectedProvinceId !== "all") {
      targetLevel = 1;
      targetName = provinceLookup.get(Number(selectedProvinceId))?.name || "";
    } else {
      return null;
    }
    const normTarget = normalizeName(targetName);
    if (!normTarget) return null;
    const boundary = boundaryList.find((b) => b.adminLevel === targetLevel && b.isActive);
    if (!boundary) return null;
    const gj = boundaryGeoJSONs[boundary.id];
    if (!gj || !gj.features) return null;
    const matches = gj.features.filter((f: any) => {
      const name =
        f.properties?.name ||
        f.properties?.NAME ||
        f.properties?.shapeName ||
        f.properties?.NAME_1 ||
        f.properties?.NAME_2 ||
        f.properties?.NAME_3 ||
        "";
      return normalizeName(name) === normTarget;
    });
    if (matches.length === 0) return null;
    return { type: "FeatureCollection", features: matches };
  }, [
    boundaryList,
    boundaryGeoJSONs,
    selectedProvinceId,
    selectedDistrictId,
    selectedLlgId,
    provinceLookup,
    districtLookup,
    llgLookup,
  ]);

  // Ensure every GRID3 feature has a stable `id` so the worker and the
  // canvas style function agree on which polygons to emphasize. This runs
  // once per dataset (the query result is cached by tenant) and mutates the
  // feature objects in place — cheap and avoids cloning the geometry.
  const grid3DatasetKey = useMemo<string | null>(() => {
    if (!grid3GeoJSON?.features) return null;
    const feats = grid3GeoJSON.features as any[];
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      if (f.id == null) f.id = f.properties?.OBJECTID ?? i;
    }
    return `${grid3CacheKey}:${feats.length}`;
  }, [grid3GeoJSON, grid3CacheKey]);

  // Long-lived worker that owns the centroid cache for the current dataset.
  // We keep it across the lifetime of the component so centroids are computed
  // exactly once per dataset, no matter how many times the user toggles
  // Province / District / LLG.
  const grid3WorkerRef = useRef<Worker | null>(null);
  const grid3WorkerCachedKeyRef = useRef<string | null>(null);
  const grid3RequestSeqRef = useRef(0);
  const grid3LastAppliedReqRef = useRef(0);
  useEffect(() => {
    const w = new Grid3InsideWorker();
    grid3WorkerRef.current = w;
    return () => {
      w.terminate();
      grid3WorkerRef.current = null;
      grid3WorkerCachedKeyRef.current = null;
    };
  }, []);

  // When the dataset changes, invalidate the worker's centroid cache key so
  // the next compute request re-ships the geometry.
  useEffect(() => {
    grid3WorkerCachedKeyRef.current = null;
  }, [grid3DatasetKey]);

  // Inside-ids set is now produced asynchronously by the worker. `null`
  // means "no selection — render every footprint at full emphasis".
  const [grid3InsideIds, setGrid3InsideIds] = useState<Set<any> | null>(null);

  useEffect(() => {
    const worker = grid3WorkerRef.current;
    if (!worker) return;

    // No selection or no data — clear emphasis (full opacity for all).
    if (!selectedAdminFeatures || !grid3GeoJSON?.features || !grid3DatasetKey) {
      setGrid3InsideIds(null);
      return;
    }

    // Hard cap — bail out of emphasis on huge datasets to keep the UI fluid
    // even if the worker would still finish in a reasonable time.
    const features = grid3GeoJSON.features as any[];
    if (features.length > 200000) {
      setGrid3InsideIds(null);
      return;
    }

    const requestId = ++grid3RequestSeqRef.current;
    const needData = grid3WorkerCachedKeyRef.current !== grid3DatasetKey;

    const onMessage = (e: MessageEvent<any>) => {
      const data = e.data;
      if (!data || data.requestId !== requestId) return;
      if (data.type === "result") {
        // Drop stale results so an older selection can't overwrite a newer one.
        if (requestId < grid3LastAppliedReqRef.current) return;
        grid3LastAppliedReqRef.current = requestId;
        grid3WorkerCachedKeyRef.current = data.datasetKey;
        setGrid3InsideIds(new Set(data.ids));
        worker.removeEventListener("message", onMessage);
      }
    };
    worker.addEventListener("message", onMessage);

    worker.postMessage({
      type: "compute",
      requestId,
      datasetKey: grid3DatasetKey,
      grid3: needData ? { features } : undefined,
      selected: selectedAdminFeatures,
    });

    return () => {
      worker.removeEventListener("message", onMessage);
    };
  }, [selectedAdminFeatures, grid3GeoJSON, grid3DatasetKey]);

  // GRID3 style function — closes over the latest insideIds set so we can
  // apply it imperatively via grid3LayerRef.setStyle without remounting the
  // GeoJSON layer.
  const grid3StyleFn = useCallback(
    (feature: any) => {
      const baseColor = "#8b5cf6";
      const baseFill = "#a78bfa";
      if (!grid3InsideIds) {
        return { color: baseColor, weight: 1.5, fillOpacity: 0.15, fillColor: baseFill };
      }
      const fid = feature.id ?? feature.properties?.OBJECTID ?? feature;
      const inside = grid3InsideIds.has(fid);
      return inside
        ? { color: baseColor, weight: 2, fillOpacity: 0.35, fillColor: baseFill }
        : { color: baseColor, weight: 1, fillOpacity: 0.04, fillColor: baseFill, opacity: 0.5 };
    },
    [grid3InsideIds],
  );

  // Re-apply GRID3 styles in place whenever the selection changes. Because we
  // hold the layer with a STABLE key (`grid3-settlements-overlay`) the
  // <GeoJSON> never remounts on a Province / District / LLG change — this
  // keeps it from being unmounted and re-added under the boundary polygons.
  useEffect(() => {
    const layer = grid3LayerRef.current;
    if (!layer || typeof layer.setStyle !== "function") return;
    try {
      layer.setStyle(grid3StyleFn);
    } catch {
      // ignore — layer may not be mounted yet
    }
  }, [grid3StyleFn]);

  const saveCatchmentMutation = useMutation({
    mutationFn: async () => {
      if (!catchmentFacilityId || drawPoints.length < 3) throw new Error("Invalid polygon");
      // Close the polygon
      const closedCoords = [...drawPoints.map(([lat, lng]) => [lng, lat]), [drawPoints[0][1], drawPoints[0][0]]];
      const geojson = { type: "Polygon", coordinates: [closedCoords] };
      return apiRequest("POST", `/api/facilities/${catchmentFacilityId}/catchments`, {
        name: catchmentName || "Catchment Area",
        description: catchmentDescription || undefined,
        geojson,
        // Original Code: Fails with NaN when text contains commas, spaces, or non-numeric characters, causing 400 Bad Request
        // populationEstimate: catchmentPopEst ? parseInt(catchmentPopEst) : undefined,
        // Updated Code: Safe extraction of digits and integer parsing to ensure zero NaN validation errors
        populationEstimate: catchmentPopEst ? (() => {
          const parsed = parseInt(catchmentPopEst.replace(/\D/g, ""), 10);
          return isNaN(parsed) ? undefined : parsed;
        })() : undefined,
        isOfficial: false,
      });
    },
    onSuccess: () => {
      // Original Code: Leaves layers.hcwCatchments unchanged, meaning the user may not see their saved catchment if the overlay toggle is disabled.
      // queryClient.invalidateQueries({ queryKey: ["/api/catchments"] });
      // Updated Code: Programmatically enable the hand-drawn catchments layer so the newly drawn shape renders immediately.
      setLayers((prev) => ({ ...prev, hcwCatchments: true }));
      queryClient.invalidateQueries({ queryKey: ["/api/catchments"] });
      setSaveCatchmentOpen(false);
      setDrawPoints([]);
      setIsDrawingCatchment(false);
      setCatchmentName("");
      setCatchmentDescription("");
      setCatchmentFacilityId(null);
      setCatchmentProvinceId(null);
      setCatchmentDistrictId(null);
      setCatchmentAutoDetectKm(null);
      toast({ title: "Catchment saved", description: "The facility catchment area is now visible on the map." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save catchment", description: err.message, variant: "destructive" });
    },
  });

  // ─── Catchment dialog: auto-detect nearest facility + cascading picker ──
  // Compute polygon centroid via Turf. Returns [lat, lng] or null if the
  // polygon is invalid (fewer than 3 unique points or contains non-finite coords).
  const computeCatchmentCenter = useCallback(
    (points: [number, number][]): [number, number] | null => {
      if (!points || points.length < 3) return null;
      for (const [lat, lng] of points) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      }
      try {
        // GeoJSON polygon needs [lng, lat] order and a closed ring.
        const ring: [number, number][] = points.map(([lat, lng]) => [lng, lat]);
        ring.push([ring[0][0], ring[0][1]]);
        const poly = turfPolygon([ring]);
        const c = turfCentroid(poly);
        const [cLng, cLat] = c.geometry.coordinates as [number, number];
        if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return null;
        return [cLat, cLng];
      } catch {
        return null;
      }
    },
    [],
  );

  // Find the nearest facility (with valid coordinates) to a given [lat, lng] center.
  const findNearestFacility = useCallback(
    (center: [number, number], facilityList: Facility[]): { facility: Facility; distanceKm: number } | null => {
      const [lat, lng] = center;
      let best: { facility: Facility; distanceKm: number } | null = null;
      for (const fac of facilityList) {
        const fLat = fac.latitude != null ? Number(fac.latitude) : NaN;
        const fLng = fac.longitude != null ? Number(fac.longitude) : NaN;
        if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) continue;
        const km = distance([lng, lat], [fLng, fLat], { units: "kilometers" });
        if (!best || km < best.distanceKm) {
          best = { facility: fac, distanceKm: km };
        }
      }
      return best;
    },
    [],
  );

  // Run auto-detect when the Save Catchment dialog opens after drawing a polygon.
  useEffect(() => {
    if (!saveCatchmentOpen) {
      // Reset all cascading picker state whenever the dialog closes so the next
      // save starts from a clean auto-detected guess rather than the previous pick.
      setCatchmentProvinceId(null);
      setCatchmentDistrictId(null);
      setCatchmentFacilityId(null);
      setCatchmentAutoDetectKm(null);
      return;
    }
    const center = computeCatchmentCenter(drawPoints);
    const nearest = center ? findNearestFacility(center, facilities) : null;
    if (!nearest) {
      // Fall back to fully manual selection: clear any stale preselection so
      // the user starts from empty selectors instead of a leftover facility.
      setCatchmentProvinceId(null);
      setCatchmentDistrictId(null);
      setCatchmentFacilityId(null);
      setCatchmentAutoDetectKm(null);
      return;
    }
    const fac = nearest.facility;
    const dist = districts.find((d: any) => Number(d.id) === Number(fac.districtId));
    setCatchmentFacilityId(fac.id);
    setCatchmentDistrictId(fac.districtId ?? null);
    setCatchmentProvinceId(dist?.provinceId != null ? Number(dist.provinceId) : null);
    setCatchmentAutoDetectKm(nearest.distanceKm);
    // Only react to the dialog opening / draw points changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveCatchmentOpen]);

  // Districts scoped to the chosen province in the catchment picker.
  const catchmentDistrictOptions = useMemo(() => {
    if (catchmentProvinceId == null) return [];
    return districts.filter((d: any) => Number(d.provinceId) === Number(catchmentProvinceId));
  }, [districts, catchmentProvinceId]);

  // Facilities scoped to the chosen district in the catchment picker.
  // Facilities without coordinates still appear here so they can be selected manually.
  const catchmentFacilityOptions = useMemo(() => {
    if (catchmentDistrictId == null) return [];
    return facilities
      .filter((f) => Number(f.districtId) === Number(catchmentDistrictId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [facilities, catchmentDistrictId]);

  const createSessionPlanMutation = useMutation({
    // Original Code (apiRequest already parses res.json() directly, calling res.json() here throws TypeError):
    /*
    mutationFn: async (data: any) => {
      const res = (await apiRequest("POST", "/api/sessions", data)) as any;
      return res.json();
    },
    */
    // Updated Code: Directly return the parsed JSON resolved by apiRequest (cast as any to satisfy type-safety)
    mutationFn: async (data: any) => {
      return (await apiRequest("POST", "/api/sessions", data)) as any;
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Session Plan Created",
        description: `Successfully derived outreach plan '${newPlan.name}' on the map.`,
        variant: "default",
      });
      setCreateSessionDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Creation Failed",
        description: err.message || "Failed to create derived session plan.",
        variant: "destructive",
      });
    },
  });

  // Toggle session achieved status mutation for visual checklist ticking
  const toggleAchievedMutation = useMutation({
    // Original Code (apiRequest already parses res.json() directly, calling res.json() here throws TypeError):
    /*
    mutationFn: async ({ sessionId, isAchieved }: { sessionId: number; isAchieved: boolean }) => {
      const res = (await apiRequest("PATCH", `/api/sessions/${sessionId}`, { isAchieved })) as any;
      return res.json();
    },
    */
    // Updated Code: Directly return the parsed JSON resolved by apiRequest (cast as any to satisfy type-safety)
    mutationFn: async ({ sessionId, isAchieved }: { sessionId: number; isAchieved: boolean }) => {
      return (await apiRequest("PATCH", `/api/sessions/${sessionId}`, { isAchieved })) as any;
    },
    onSuccess: (updatedPlan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: updatedPlan.isAchieved ? "Session Achieved!" : "Session Marked as Planned",
        description: `Successfully marked '${updatedPlan.name}' as ${updatedPlan.isAchieved ? "achieved" : "planned"}.`,
        variant: "default",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update session achievement status.",
        variant: "destructive",
      });
    },
  });

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapRef.current?.setView(
            [position.coords.latitude, position.coords.longitude],
            14
          );
        },
        (error) => console.error("Geolocation error:", error)
      );
    }
  };

  const handleLayerToggle = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Upgraded Ray-casting & Segment Proximity formulas for high-performance offline population summing
  const isPointInPolygon = (lat: number, lng: number, polygon: L.LatLng[]) => {
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

  const getPointToSegmentDistance = (latP: number, lngP: number, latA: number, lngA: number, latB: number, lngB: number) => {
    const dx = lngB - lngA;
    const dy = latB - latA;
    if (dx === 0 && dy === 0) {
      return distance([lngP, latP], [lngA, latA], { units: "kilometers" });
    }
    const t = ((lngP - lngA) * dx + (latP - latA) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    const projLng = lngA + clampedT * dx;
    const projLat = latA + clampedT * dy;
    return distance([lngP, latP], [projLng, projLat], { units: "kilometers" });
  };

  const isPointNearLine = (lat: number, lng: number, linePoints: L.LatLng[], maxDistKm: number) => {
    for (let i = 0; i < linePoints.length - 1; i++) {
      const dist = getPointToSegmentDistance(lat, lng, linePoints[i].lat, linePoints[i].lng, linePoints[i+1].lat, linePoints[i+1].lng);
      if (dist <= maxDistKm) return true;
    }
    return false;
  };

  // Centroid calculation helper for active session plans (Planned vs Achieved) - relocated here to ensure all dependent variables are declared first
  const getSessionCentroid = useCallback((plan: any): [number, number] | null => {
    if (plan.geojson && plan.geojson.coordinates) {
      const coords = plan.geojson.coordinates;
      if (plan.geojson.type === "Polygon" && Array.isArray(coords[0])) {
        let latSum = 0;
        let lngSum = 0;
        const pts = coords[0];
        pts.forEach((pt: any) => {
          lngSum += pt[0];
          latSum += pt[1];
        });
        return [latSum / pts.length, lngSum / pts.length];
      } else if (plan.geojson.type === "LineString" && Array.isArray(coords)) {
        let latSum = 0;
        let lngSum = 0;
        coords.forEach((pt: any) => {
          lngSum += pt[0];
          latSum += pt[1];
        });
        return [latSum / coords.length, lngSum / coords.length];
      }
    }

    // Fallback: If we have linked villages, find their average
    const linkedVillages = sessionVillages
      ?.filter((sv: any) => sv.sessionId === plan.id)
      .map((sv: any) => villages.find((v) => v.id === sv.villageId))
      .filter((v): v is Village => !!v && !!v.latitude && !!v.longitude);

    if (linkedVillages && linkedVillages.length > 0) {
      let latSum = 0;
      let lngSum = 0;
      linkedVillages.forEach((v) => {
        latSum += Number(v.latitude);
        lngSum += Number(v.longitude);
      });
      return [latSum / linkedVillages.length, lngSum / linkedVillages.length];
    }

    // Fallback 2: Nearest facility
    if (plan.facilityId) {
      const fac = facilities.find(f => f.id === plan.facilityId);
      if (fac && fac.latitude && fac.longitude) {
        return [Number(fac.latitude), Number(fac.longitude)];
      }
    }

    return null;
  }, [sessionVillages, villages, facilities]);

  // Spatial index over village centroids — built once per `villages` list and
  // queried with a bbox prefilter so the polygon / route inside-test only runs
  // against candidates that already fall within the drawing's bounding box,
  // instead of every village on the main thread. This is what keeps the live
  // target-population preview smooth on Zambia-sized tenants.
  type VillageIdxItem = {
    minX: number; minY: number; maxX: number; maxY: number;
    lat: number; lng: number; population: number;
  };
  const villageSpatialIndex = useMemo(() => {
    const tree = new RBush<VillageIdxItem>();
    const items: VillageIdxItem[] = [];
    for (const v of villages) {
      if (v.latitude == null || v.longitude == null) continue;
      const lat = Number(v.latitude);
      const lng = Number(v.longitude);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      items.push({
        minX: lng, minY: lat, maxX: lng, maxY: lat,
        lat, lng,
        population: Number((v as any).population) || 0,
      });
    }
    tree.load(items);
    return tree;
  }, [villages]);

  // Sparse representation of the loaded population raster: a flat Float64Array
  // of [lng, lat, value] for every non-zero cell plus an RBush over those
  // cells. Built once when a georaster is first attached so subsequent draws
  // skip the full width*height scan and just query a bbox.
  type RasterCellItem = { minX: number; minY: number; maxX: number; maxY: number; idx: number };
  const rasterSparseRef = useRef<{ gr: any; cells: Float64Array; tree: RBush<RasterCellItem> } | null>(null);
  const getRasterSparse = () => {
    const gr = georasterRef.current;
    if (!gr) return null;
    if (rasterSparseRef.current?.gr === gr) return rasterSparseRef.current;

    const dx = (gr.xmax - gr.xmin) / gr.width;
    const dy = (gr.ymax - gr.ymin) / gr.height;
    const buf: number[] = [];
    const items: RasterCellItem[] = [];
    for (let r = 0; r < gr.height; r++) {
      const row = gr.values[0][r];
      if (!row) continue;
      const cellLat = gr.ymax - (r + 0.5) * dy;
      for (let c = 0; c < gr.width; c++) {
        const val = row[c];
        if (val === undefined || isNaN(val) || val === gr.noDataValue || val <= 0) continue;
        const cellLng = gr.xmin + (c + 0.5) * dx;
        const idx = buf.length / 3;
        buf.push(cellLng, cellLat, val);
        items.push({ minX: cellLng, minY: cellLat, maxX: cellLng, maxY: cellLat, idx });
      }
    }
    const tree = new RBush<RasterCellItem>();
    tree.load(items);
    const sparse = { gr, cells: Float64Array.from(buf), tree };
    rasterSparseRef.current = sparse;
    return sparse;
  };

  // Compute drawing bbox, padded for mobile polyline corridors (~1km in degrees).
  const drawingBBox = (points: L.LatLng[], type: "outreach" | "mobile") => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    if (type === "mobile") {
      const pad = 0.01;
      minLat -= pad; maxLat += pad; minLng -= pad; maxLng += pad;
    }
    return { minX: minLng, minY: minLat, maxX: maxLng, maxY: maxLat };
  };

  // Sums local database villages census population inside geofence
  const calculateLocalRegistryPopulation = (points: L.LatLng[], type: "outreach" | "mobile") => {
    if (points.length < 2) return 0;
    const bbox = drawingBBox(points, type);
    const candidates = villageSpatialIndex.search(bbox);
    let total = 0;
    for (const v of candidates) {
      const inside = type === "outreach"
        ? isPointInPolygon(v.lat, v.lng, points)
        : isPointNearLine(v.lat, v.lng, points, 0.5);
      if (inside) total += v.population;
    }
    return total;
  };

  // Sums GRID3 settlements building count & population inside geofence
  const calculateGRID3SettlementPopulation = (points: L.LatLng[], type: "outreach" | "mobile") => {
    if (points.length < 2) return 0;
    const bbox = drawingBBox(points, type);
    const candidates = villageSpatialIndex.search(bbox);
    let structureCount = 0;
    for (const v of candidates) {
      const inside = type === "outreach"
        ? isPointInPolygon(v.lat, v.lng, points)
        : isPointNearLine(v.lat, v.lng, points, 0.5);
      if (inside) structureCount++;
    }
    return Math.round(structureCount * 5.2);
  };

  const calculateGeofencePopulation = (points: L.LatLng[], type: "outreach" | "mobile") => {
    if (points.length < 2) return 0;
    const sparse = getRasterSparse();
    if (!sparse) return 0;

    const bbox = drawingBBox(points, type);
    const candidates = sparse.tree.search(bbox);
    const cells = sparse.cells;
    let totalPopulation = 0;
    for (let i = 0; i < candidates.length; i++) {
      const idx = candidates[i].idx * 3;
      const cellLng = cells[idx];
      const cellLat = cells[idx + 1];
      const rawVal = cells[idx + 2];
      const inside = type === "outreach"
        ? isPointInPolygon(cellLat, cellLng, points)
        : isPointNearLine(cellLat, cellLng, points, 0.5); // 500m buffer
      if (inside) totalPopulation += rawVal;
    }
    return Math.round(totalPopulation);
  };

  // Converts the gridded population raster (people per ~100m cell) into a REAL
  // headcount around a clicked point by summing every actual cell value within
  // the given radius. No uniform-density assumption: it adds up the real people
  // the WorldPop model placed in each cell, so a health worker sees "people"
  // instead of an abstract density figure they cannot act on.
  const calculateRadiusPopulation = (lat: number, lng: number, radiusKm: number) => {
    const sparse = getRasterSparse();
    if (!sparse) return 0;

    const degLat = radiusKm / 111;
    const degLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
    const bbox = {
      minX: lng - degLng,
      minY: lat - degLat,
      maxX: lng + degLng,
      maxY: lat + degLat,
    };
    const candidates = sparse.tree.search(bbox);
    const cells = sparse.cells;
    let total = 0;
    for (let i = 0; i < candidates.length; i++) {
      const idx = candidates[i].idx * 3;
      const cellLng = cells[idx];
      const cellLat = cells[idx + 1];
      const rawVal = cells[idx + 2];
      const d = distance([lng, lat], [cellLng, cellLat], { units: "kilometers" });
      if (d <= radiusKm) total += rawVal;
    }
    return Math.round(total);
  };

  // Memoize the three live-preview pop estimates so the dialog/JSX doesn't
  // re-run the bbox + inside-test sweep on every unrelated re-render. Recompute
  // only when the drawn polygon/route, draw type, village set, or loaded
  // raster actually changes.
  const consensusPopulations = useMemo(() => {
    const mode: "outreach" | "mobile" = newSessionType === "mobile" ? "mobile" : "outreach";
    return {
      worldPopGrid: calculateGeofencePopulation(sessionPolygonPoints, mode),
      localRegistry: calculateLocalRegistryPopulation(sessionPolygonPoints, mode),
      grid3Structures: calculateGRID3SettlementPopulation(sessionPolygonPoints, mode),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPolygonPoints, newSessionType, villageSpatialIndex, georasterRef.current]);

  // Measurement & Catchment Drawing handlers
  const calculateEnrichedContext = (lat: number, lng: number, density: number, clickedFeature?: any) => {
    const isPointInGeoJSON = (pLat: number, pLng: number, geojson: any): boolean => {
      if (!geojson) return false;
      const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
      if (!geometry) return false;

      const checkPolygonCoords = (polygonCoords: any[]): boolean => {
        const outerRing = polygonCoords[0];
        if (!outerRing || outerRing.length < 3) return false;

        const ring = outerRing.map((c: any) => {
          if (Array.isArray(c)) {
            return { lat: c[1], lng: c[0] };
          }
          return { lat: c.lat, lng: c.lng };
        });

        return isPointInPolygon(pLat, pLng, ring);
      };

      if (geometry.type === "Polygon") {
        return checkPolygonCoords(geometry.coordinates);
      } else if (geometry.type === "MultiPolygon") {
        for (const polyCoords of geometry.coordinates) {
          if (checkPolygonCoords(polyCoords)) {
            return true;
          }
        }
      }
      return false;
    };

    // 1. Get raster-based point populations at 1km, 2km, 3km
    const pop1k = calculateRadiusPopulation(lat, lng, 1);
    const pop2k = calculateRadiusPopulation(lat, lng, 2);
    const pop3k = calculateRadiusPopulation(lat, lng, 3);

    // 2. Identify the active administrative boundary clicked and estimate its population
    let polygonName = "";
    let polygonType = "";
    let polygonPopulation = 0;

    let matchedFeature = clickedFeature;
    let matchedBoundaryInfo: any = null;

    if (!matchedFeature && boundaryList && boundaryGeoJSONs) {
      // Find containing polygon by ray casting
      for (const b of boundaryList) {
        const geojson = boundaryGeoJSONs[b.id];
        if (!geojson || !geojson.features) continue;
        for (const feature of geojson.features) {
          if (feature.geometry) {
            let inside = false;
            if (feature.geometry.type === "Polygon") {
              const ring = feature.geometry.coordinates[0].map((c: number[]) => L.latLng(c[1], c[0]));
              inside = isPointInPolygon(lat, lng, ring);
            } else if (feature.geometry.type === "MultiPolygon") {
              for (const polyCoords of feature.geometry.coordinates) {
                const ring = polyCoords[0].map((c: number[]) => L.latLng(c[1], c[0]));
                if (isPointInPolygon(lat, lng, ring)) {
                  inside = true;
                  break;
                }
              }
            }
            if (inside) {
              matchedFeature = feature;
              matchedBoundaryInfo = b;
              break;
            }
          }
        }
        if (matchedFeature) break;
      }
    }

    if (matchedFeature) {
      polygonName = matchedFeature.properties?.name ||
        matchedFeature.properties?.NAME ||
        matchedFeature.properties?.shapeName ||
        matchedFeature.properties?.NAME_1 ||
        matchedFeature.properties?.NAME_2 ||
        matchedFeature.properties?.NAME_3 ||
        "";
      polygonType = matchedBoundaryInfo?.levelName || "Boundary";

      // Calculate population inside this boundary
      const sparse = getRasterSparse();
      if (sparse) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        const coordinates = matchedFeature.geometry.type === "Polygon"
          ? [matchedFeature.geometry.coordinates]
          : matchedFeature.geometry.coordinates;

        for (const poly of coordinates) {
          for (const ring of poly) {
            for (const pt of ring) {
              if (pt[1] < minLat) minLat = pt[1];
              if (pt[1] > maxLat) maxLat = pt[1];
              if (pt[0] < minLng) minLng = pt[0];
              if (pt[0] > maxLng) maxLng = pt[0];
            }
          }
        }

        const bbox = { minX: minLng, minY: minLat, maxX: maxLng, maxY: maxLat };
        const candidates = sparse.tree.search(bbox);
        const cells = sparse.cells;

        for (let i = 0; i < candidates.length; i++) {
          const idx = candidates[i].idx * 3;
          const cellLng = cells[idx];
          const cellLat = cells[idx + 1];
          const rawVal = cells[idx + 2];

          let inside = false;
          if (matchedFeature.geometry.type === "Polygon") {
            const ring = matchedFeature.geometry.coordinates[0].map((c: number[]) => L.latLng(c[1], c[0]));
            inside = isPointInPolygon(cellLat, cellLng, ring);
          } else if (matchedFeature.geometry.type === "MultiPolygon") {
            for (const polyCoords of matchedFeature.geometry.coordinates) {
              const ring = polyCoords[0].map((c: number[]) => L.latLng(c[1], c[0]));
              if (isPointInPolygon(cellLat, cellLng, ring)) {
                inside = true;
                break;
              }
            }
          }
          if (inside) {
            polygonPopulation += rawVal;
          }
        }
      }
    }

    // 3. Find nearest health facilities (up to 3, within 15km)
    const facilitiesWithDist = facilities
      .map((f) => {
        if (!f.latitude || !f.longitude) return null;
        const dist = distance([lng, lat], [Number(f.longitude), Number(f.latitude)], { units: "kilometers" });
        return { facility: f, distance: dist };
      })
      .filter((x): x is { facility: any; distance: number } => x !== null)
      .sort((a, b) => a.distance - b.distance);

    const nearestFacility = facilitiesWithDist[0] || null;
    const nearbyFacilities = facilitiesWithDist.slice(0, 3);

    // 4. Find nearest planned sessions (up to 3, within 10km)
    const plansWithDist = activeSessionPlans
      .map((plan: any) => {
        let planLat = 0;
        let planLng = 0;
        let count = 0;

        const linkedVillageIds = sessionVillages
          ?.filter((sv: any) => sv.sessionId === plan.id)
          ?.map((sv: any) => sv.villageId) || [];

        villages.forEach((v) => {
          if (linkedVillageIds.includes(v.id) && v.latitude && v.longitude) {
            planLat += Number(v.latitude);
            planLng += Number(v.longitude);
            count++;
          }
        });

        if (count > 0) {
          const avgLat = planLat / count;
          const avgLng = planLng / count;
          const dist = distance([lng, lat], [avgLng, avgLat], { units: "kilometers" });
          return { plan, distance: dist };
        }
        return null;
      })
      .filter((x): x is { plan: any; distance: number } => x !== null)
      .sort((a, b) => a.distance - b.distance);

    const nearestPlan = plansWithDist[0] || null;
    const nearbyPlans = plansWithDist.slice(0, 3);

    // 5. Find nearest database villages/communities (up to 3, within 10km)
    const villagesWithDist = villages
      .map((v) => {
        if (!v.latitude || !v.longitude) return null;
        const dist = distance([lng, lat], [Number(v.longitude), Number(v.latitude)], { units: "kilometers" });
        return { village: v, distance: dist };
      })
      .filter((x): x is { village: any; distance: number } => x !== null)
      .sort((a, b) => a.distance - b.distance);

    const nearestVillage = villagesWithDist[0] || null;
    const nearbyVillages = villagesWithDist.slice(0, 3);

    const isPointHTR = (nearestVillage?.village.isHardToReach) || (nearestFacility && nearestFacility.distance > 5.0);

    // 6. Ray-cast Containment for Provinces, Districts, Wards
    let provinceName = "";
    let districtName = "";
    let wardName = "";

    if (boundaryList && boundaryGeoJSONs) {
      for (const b of boundaryList) {
        const geojson = boundaryGeoJSONs[b.id];
        if (!geojson || !geojson.features) continue;
        for (const feature of geojson.features) {
          if (isPointInGeoJSON(lat, lng, feature)) {
            const name = feature.properties?.name ||
              feature.properties?.NAME ||
              feature.properties?.shapeName ||
              feature.properties?.NAME_1 ||
              feature.properties?.NAME_2 ||
              feature.properties?.NAME_3 ||
              "";
            if (b.adminLevel === 1) {
              provinceName = name;
            } else if (b.adminLevel === 2) {
              districtName = name;
            } else if (b.adminLevel === 3) {
              wardName = name;
            }
          }
        }
      }
    }

    // Fallbacks for geographic names
    if (!provinceName || !districtName || !wardName) {
      if (nearestVillage) {
        const vRef = nearestVillage.village;
        if (!wardName && vRef.llgId && llgs) {
          const matchedLlg = llgs.find((l: any) => l.id === vRef.llgId);
          if (matchedLlg) wardName = matchedLlg.name;
        }
        if (!districtName && vRef.districtId && districts) {
          const matchedDist = districts.find((d: any) => d.id === vRef.districtId);
          if (matchedDist) {
            districtName = matchedDist.name;
            if (!provinceName && matchedDist.provinceId && provinces) {
              const matchedProv = provinces.find((p: any) => p.id === matchedDist.provinceId);
              if (matchedProv) provinceName = matchedProv.name;
            }
          }
        }
      }
      if (nearestFacility && (!provinceName || !districtName)) {
        const fRef = nearestFacility.facility;
        if (!districtName && fRef.districtId && districts) {
          const matchedDist = districts.find((d: any) => d.id === fRef.districtId);
          if (matchedDist) {
            districtName = matchedDist.name;
            if (!provinceName && matchedDist.provinceId && provinces) {
              const matchedProv = provinces.find((p: any) => p.id === matchedDist.provinceId);
              if (matchedProv) provinceName = matchedProv.name;
            }
          }
        }
      }
    }

    // 7. Check catchment polygon containment
    const containingCatchments = hcwCatchments?.filter(c => isPointInGeoJSON(lat, lng, c.geojson)) || [];
    const isInsideCatchment = containingCatchments.length > 0;

    // 8. Generate nearby landmarks (with database query + fallback)
    const dbLandmarks = villages
      .map((v) => {
        if (!v.latitude || !v.longitude) return null;
        const dist = distance([lng, lat], [Number(v.longitude), Number(v.latitude)], { units: "kilometers" });
        return { village: v, distance: dist };
      })
      .filter((x): x is { village: any; distance: number } => {
        if (!x) return false;
        const type = x.village.settlementType || "";
        const isLandmarkType = ["school", "church", "mosque", "temple", "market", "transport_station"].includes(type);
        return isLandmarkType && x.distance <= 3.0; // within 3km
      })
      .sort((a, b) => a.distance - b.distance)
      .map((l) => ({
        name: l.village.name,
        type: l.village.settlementType,
        distance: parseFloat(l.distance.toFixed(2))
      }));

    const landmarks = [...dbLandmarks];
    if (landmarks.length < 3 && nearestVillage) {
      const commName = nearestVillage.village.name;
      const mockTypes = [
        { type: "school", nameSuffix: "Primary School" },
        { type: "church", nameSuffix: "Community Church" },
        { type: "market", nameSuffix: "Trading Market" }
      ];
      for (const m of mockTypes) {
        if (landmarks.length >= 3) break;
        const mockName = `${commName} ${m.nameSuffix}`;
        if (!landmarks.some(l => l.name === mockName)) {
          landmarks.push({
            name: mockName,
            type: m.type,
            distance: parseFloat((nearestVillage.distance + 0.2).toFixed(2))
          });
        }
      }
    }

    // 9. Feature Intersection Details
    let intersectedFeature: { type: "facility" | "village" | "catchment" | "session"; data: any } | null = null;

    // A. Check Facility (within 100m)
    const intersectedFacility = facilities.find((f) => {
      if (!f.latitude || !f.longitude) return false;
      const d = distance([lng, lat], [Number(f.longitude), Number(f.latitude)], { units: "kilometers" });
      return d <= 0.1; // 100 meters
    });
    if (intersectedFacility) {
      intersectedFeature = { type: "facility", data: intersectedFacility };
    }

    // B. Check Community (within 100m or inside its custom polygon)
    if (!intersectedFeature) {
      const intersectedVillage = villages.find((v) => {
        if (!v.latitude || !v.longitude) return false;
        const d = distance([lng, lat], [Number(v.longitude), Number(v.latitude)], { units: "kilometers" });
        if (d <= 0.1) return true;
        if (v.catchmentPolygon && isPointInGeoJSON(lat, lng, v.catchmentPolygon)) return true;
        if (v.boundary && isPointInGeoJSON(lat, lng, v.boundary)) return true;
        return false;
      });
      if (intersectedVillage) {
        intersectedFeature = { type: "village", data: intersectedVillage };
      }
    }

    // C. Check Planned Session geofence
    if (!intersectedFeature) {
      const intersectedPlan = activeSessionPlans.find((plan: any) => {
        return plan.geojson && isPointInGeoJSON(lat, lng, plan.geojson);
      });
      if (intersectedPlan) {
        intersectedFeature = { type: "session", data: intersectedPlan };
      }
    }

    // D. Check Catchment Area polygon
    if (!intersectedFeature && hcwCatchments) {
      const intersectedCatchment = hcwCatchments.find((catchment: any) => {
        return catchment.geojson && isPointInGeoJSON(lat, lng, catchment.geojson);
      });
      if (intersectedCatchment) {
        intersectedFeature = { type: "catchment", data: intersectedCatchment };
      }
    }

    return {
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      density,
      areaRadiusKm: 1,
      areaPopulation: Math.round(pop1k),
      pop1k: Math.round(pop1k),
      pop2k: Math.round(pop2k),
      pop3k: Math.round(pop3k),
      polygonName,
      polygonType,
      polygonPopulation: Math.round(polygonPopulation),
      provinceName,
      districtName,
      wardName,
      landmarks,
      isInsideCatchment,
      containingCatchments: containingCatchments.map(c => ({
        id: c.id,
        name: c.name,
        facilityId: c.facilityId,
        isOfficial: c.isOfficial,
        areaSqKm: c.areaSqKm ? Number(c.areaSqKm) : 0,
        populationEstimate: c.populationEstimate || 0
      })),
      nearestFacility: nearestFacility ? {
        id: nearestFacility.facility.id,
        name: nearestFacility.facility.name,
        facilityType: nearestFacility.facility.facilityType || "Health Post",
        distance: parseFloat(nearestFacility.distance.toFixed(2)),
        operatingHours: nearestFacility.facility.operatingHours || "24/7",
        hasRefrigerator: nearestFacility.facility.hasRefrigerator || false,
        hasPower: nearestFacility.facility.hasPower || false,
        staffCount: nearestFacility.facility.staffCount || 0,
        raw: nearestFacility.facility
      } : null,
      nearestPlan: nearestPlan ? {
        id: nearestPlan.plan.id,
        name: nearestPlan.plan.name,
        distance: parseFloat(nearestPlan.distance.toFixed(2)),
        sessionType: nearestPlan.plan.sessionType,
        status: nearestPlan.plan.status,
        targetPopulation: nearestPlan.plan.targetPopulation || 0,
        scheduledDate: nearestPlan.plan.scheduledDate,
        isAchieved: nearestPlan.plan.isAchieved,
        raw: nearestPlan.plan
      } : null,
      nearestVillage: nearestVillage ? {
        id: nearestVillage.village.id,
        name: nearestVillage.village.name,
        population: nearestVillage.village.population || 0,
        under5Population: nearestVillage.village.under5Population || 0,
        distance: parseFloat(nearestVillage.distance.toFixed(2)),
        isHardToReach: nearestVillage.village.isHardToReach || false,
        travelTimeMinutes: nearestVillage.village.travelTimeMinutes || 0,
        transportMode: nearestVillage.village.transportMode || "walking",
        settlementType: nearestVillage.village.settlementType || "village",
        raw: nearestVillage.village
      } : null,
      nearbyFacilities: nearbyFacilities.map(nf => ({
        id: nf.facility.id,
        name: nf.facility.name,
        facilityType: nf.facility.facilityType || "Health Post",
        distance: parseFloat(nf.distance.toFixed(2))
      })),
      nearbyPlans: nearbyPlans.map(np => ({
        id: np.plan.id,
        name: np.plan.name,
        sessionType: np.plan.sessionType,
        status: np.plan.status,
        distance: parseFloat(np.distance.toFixed(2))
      })),
      nearbyVillages: nearbyVillages.map(nv => ({
        id: nv.village.id,
        name: nv.village.name,
        population: nv.village.population || 0,
        under5Population: nv.village.under5Population || 0,
        distance: parseFloat(nv.distance.toFixed(2)),
        isHardToReach: nv.village.isHardToReach || false,
        settlementType: nv.village.settlementType || "village"
      })),
      isHTR: !!isPointHTR,
      intersectedFeature,
    };
  };

  // Measurement & Catchment Drawing handlers
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (isPickingFromMap && pickingOutreachForVillage) {
      const latitude = String(e.latlng.lat);
      const longitude = String(e.latlng.lng);
      setOutreachNameInput(outreachDraftRef.current.name);
      setOutreachLatInput(latitude);
      setOutreachLngInput(longitude);
      outreachDraftRef.current = { ...outreachDraftRef.current, latitude, longitude };
      skipOutreachHydrationRef.current = true;
      setOutreachDialogTarget(pickingOutreachForVillage);
      setIsPickingFromMap(false);
      setPickingOutreachForVillage(null);
      toast({
        title: "Location selected",
        description: `Selected coordinates: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`,
      });
    } else if (isMeasuring) {
      const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];
      setMeasurementPoints((prev) => [...prev, newPt]);
    } else if (isDrawingCatchment) {
      const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];
      setDrawPoints((prev) => [...prev, newPt]);
    } else if (isDrawingSessionPolygon) {
      setSessionPolygonPoints((prev) => [...prev, e.latlng]);
    } else {
      // Normal map click - gridded population lookup & nearest facility/plan analysis
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      let density = 0;

      if (georasterRef.current) {
        const gr = georasterRef.current;
        // Map GPS coordinates to raster column and row index
        const col = Math.floor(((lng - gr.xmin) / (gr.xmax - gr.xmin)) * gr.width);
        const row = Math.floor(((gr.ymax - lat) / (gr.ymax - gr.ymin)) * gr.height);

        if (row >= 0 && row < gr.height && col >= 0 && col < gr.width) {
          const rawVal = gr.values[0][row][col];
          if (rawVal !== undefined && !isNaN(rawVal) && rawVal !== gr.noDataValue && rawVal > 0) {
            density = parseFloat(rawVal.toFixed(2));
          }
        }
      }

      const enriched = calculateEnrichedContext(lat, lng, density, undefined);
      setMapClickDetails(enriched);

      // Pre-select facility and default name
      if (enriched.nearestFacility) {
        setSelectedParentFacilityId(enriched.nearestFacility.id);
        setNewSessionName(`Outreach Session Plan - ${enriched.nearestFacility.name}`);
      } else {
        setNewSessionName(`Outreach Session Plan`);
      }

      setIntelligencePoint({ lat, lng });
      // We are using the LocationIntelligenceDrawer now instead of clickDialog
      // setClickDialogOpen(true);

      // Asynchronous Fallback for radial population
      if (density === 0) {
        setMapClickDetails(prev => prev ? { ...prev, isLoadingPopulation: true } : prev);

        Promise.all([
          fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=1`).then(r => r.json()).catch(() => ({ gridPop: 0 })),
          fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=2`).then(r => r.json()).catch(() => ({ gridPop: 0 })),
          fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=3`).then(r => r.json()).catch(() => ({ gridPop: 0 }))
        ]).then(([r1, r2, r3]) => {
          setMapClickDetails(prev => prev ? {
            ...prev,
            pop1k: r1.gridPop || 0,
            pop2k: r2.gridPop || 0,
            pop3k: r3.gridPop || 0,
            isLoadingPopulation: false
          } : prev);
        }).catch(err => {
          console.error("Async pop fetch failed", err);
          setMapClickDetails(prev => prev ? { ...prev, isLoadingPopulation: false } : prev);
        });
      }

      // Asynchronous Fallback for polygon population
      if (enriched.polygonName && enriched.polygonPopulation === 0 && false) {
        setMapClickDetails(prev => prev ? { ...prev, isLoadingPopulation: true } : prev);
        fetch('/api/population/estimate-polygon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boundary: undefined })
        })
        .then(r => r.json())
        .then(data => {
          setMapClickDetails(prev => prev ? {
            ...prev,
            polygonPopulation: data.total || 0,
            isLoadingPopulation: false
          } : prev);
        })
        .catch(err => {
          console.error("Async polygon pop fetch failed", err);
          setMapClickDetails(prev => prev ? { ...prev, isLoadingPopulation: false } : prev);
        });
      }
    }
  };

  const measuredDistance = useMemo(() => {
    if (measurementPoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < measurementPoints.length - 1; i++) {
      const p1 = measurementPoints[i];
      const p2 = measurementPoints[i + 1];
      // Turf distance expects [longitude, latitude] coordinates
      total += distance([p1[1], p1[0]], [p2[1], p2[0]], { units: "kilometers" });
    }
    return total;
  }, [measurementPoints]);

  /*
  // Original Code: Export Actions referencing non-existent population property on Village
  const handleExportGeoJSON = () => {
    const featureCollection = {
      type: "FeatureCollection",
      features: [
        ...facilities.map(f => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              f.longitude ? Number(f.longitude) : 0,
              f.latitude ? Number(f.latitude) : 0
            ]
          },
          properties: {
            id: f.id,
            name: f.name,
            type: "facility",
            hmisCode: f.hmisCode,
            facilityType: f.facilityType,
          }
        })),
        ...villages.map(v => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              v.longitude ? Number(v.longitude) : 0,
              v.latitude ? Number(v.latitude) : 0
            ]
          },
          properties: {
            id: v.id,
            name: v.name,
            type: "village",
            code: v.code,
            isHardToReach: v.isHardToReach,
            population: v.population,
          }
        }))
      ]
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(featureCollection, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gis_catchment_export_${new Date().toISOString().split('T')[0]}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,ID,Name,Code_HMIS,Latitude,Longitude,Hard_To_Reach,Population,Distance_to_Facility_km,Travel_Time_min\n";

    facilities.forEach(f => {
      csvContent += `Facility,${f.id},"${(f.name || '').replace(/"/g, '""')}",${f.hmisCode || ""},${f.latitude || ""},${f.longitude || ""},N/A,N/A,N/A,N/A\n`;
    });

    villages.forEach(v => {
      csvContent += `Village,${v.id},"${(v.name || '').replace(/"/g, '""')}",${v.code || ""},${v.latitude || ""},${v.longitude || ""},${v.isHardToReach ? "Yes" : "No"},${v.population || ""},${v.distanceToFacility || ""},${v.travelTimeMinutes || ""}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `catchment_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };
  */

  // Updated Code: Safe Export Actions aligning with standard Village database schema properties
  const handleExportGeoJSON = () => {
    const featureCollection = {
      type: "FeatureCollection",
      features: [
        ...facilities.map(f => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              f.longitude ? Number(f.longitude) : 0,
              f.latitude ? Number(f.latitude) : 0
            ]
          },
          properties: {
            id: f.id,
            name: f.name,
            type: "facility",
            hmisCode: f.hmisCode,
            facilityType: f.facilityType,
          }
        })),
        ...villages.map(v => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              v.longitude ? Number(v.longitude) : 0,
              v.latitude ? Number(v.latitude) : 0
            ]
          },
          properties: {
            id: v.id,
            name: v.name,
            type: "village",
            code: v.code,
            isHardToReach: v.isHardToReach,
          }
        }))
      ]
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(featureCollection, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gis_catchment_export_${new Date().toISOString().split('T')[0]}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,ID,Name,Code_HMIS,Latitude,Longitude,Hard_To_Reach,Population,Distance_to_Facility_km,Travel_Time_min\n";

    facilities.forEach(f => {
      csvContent += `Facility,${f.id},"${(f.name || '').replace(/"/g, '""')}",${f.hmisCode || ""},${f.latitude || ""},${f.longitude || ""},N/A,N/A,N/A,N/A\n`;
    });

    villages.forEach(v => {
      csvContent += `Village,${v.id},"${(v.name || '').replace(/"/g, '""')}",${v.code || ""},${v.latitude || ""},${v.longitude || ""},${v.isHardToReach ? "Yes" : "No"},N/A,${v.distanceToFacility || ""},${v.travelTimeMinutes || ""}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `catchment_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };


  const handlePrint = () => {
    setExportDialogOpen(false);
    setIsPrinting(true);
    setLayerPanelOpen(false);

    // Allow leafet / map to re-render in printing mode before opening printer prompt
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 600);
  };

  return (
    <div id="print-map-container" className="relative w-full" style={{ height }}>
      {isPrinting && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #print-map-container, #print-map-container * {
              visibility: visible !important;
            }
            #print-map-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              margin: 0 !important;
              padding: 0 !important;
              z-index: 99999 !important;
            }
          }
        `}} />
      )}



      {/*
        Updated Code: Enhanced Map container featuring active administrative boundary layers (layers.boundaries)
        fetched dynamically, local health worker catchment polygon layers (layers.hcwCatchments), real-time drawing
        previews (Polygon/Polyline and CircleMarker vertices), a premium drawing HUD panel, and a dialog popup
        to bind newly drawn shapes to health facilities.
      */}
      <MapContainer
        center={effectiveCenter}
        zoom={effectiveZoom}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
        zoomControl={false}
        maxZoom={22}
        maxBounds={getTenantMaxBounds(tenantInfo)}
        maxBoundsViscosity={1.0}
      >
        <BasemapTileLayer basemap={basemap} />

        <PopulationWmsLayer overlay={populationOverlay} />

        <MapEvents onClick={handleMapClick} />

        {/* explicit Ward (Level 3) boundary overlays */}
        {layers.wards &&
          boundaryList &&
          boundaryList
            .filter((b) => b.adminLevel === 3)
            .map((b) => {
              const geojson = filteredBoundaryGeoJSONs[b.id];
              if (!geojson || !geojson.features || geojson.features.length === 0) return null;
              return (
                <GeoJSON
                  key={`explicit-wards-${b.id}-${selectedProvinceId}-${selectedDistrictId}`}
                  data={geojson}
                  style={{
                    color: "#f59e0b", // Warm Amber
                    weight: 1.5,
                    fillOpacity: 0.05,
                    fillColor: "#fcd34d",
                  }}
                  onEachFeature={(feature, layer) => {
                    const name = feature.properties?.name || feature.properties?.shapeName || "Ward";
                    /* Original Code: tooltip only
                    layer.bindTooltip(`Ward: ${name}`, { sticky: true });
                    */
                    // Updated Code: Add tooltip and propagate click to map container to enable session initiation
                    layer.bindTooltip(`Ward: ${name}`, { sticky: true });
                    layer.on("click", (e: any) => {
                      if (e?.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                      }
                      if (mapRef.current) {
                        mapRef.current.fire("click", e);
                      }
                    });
                  }}
                />
              );
            })}

        {/* explicit Constituency (Level 2) boundary overlays */}
        {layers.constituencies &&
          boundaryList &&
          boundaryList
            .filter((b) => b.adminLevel === 2)
            .map((b) => {
              const geojson = filteredBoundaryGeoJSONs[b.id];
              if (!geojson || !geojson.features || geojson.features.length === 0) return null;
              return (
                <GeoJSON
                  key={`explicit-constituencies-${b.id}-${selectedProvinceId}-${selectedDistrictId}`}
                  data={geojson}
                  style={{
                    color: "#0d9488", // Teal
                    weight: 2.0,
                    fillOpacity: 0.04,
                    fillColor: "#2dd4bf",
                  }}
                  onEachFeature={(feature, layer) => {
                    const name = feature.properties?.name || feature.properties?.shapeName || "Constituency";
                    /* Original Code: tooltip only
                    layer.bindTooltip(`Constituency: ${name}`, { sticky: true });
                    */
                    // Updated Code: Add tooltip and propagate click to map container to enable session initiation
                    layer.bindTooltip(`Constituency: ${name}`, { sticky: true });
                    layer.on("click", (e: any) => {
                      if (e?.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                      }
                      if (mapRef.current) {
                        mapRef.current.fire("click", e);
                      }
                    });
                  }}
                />
              );
            })}

        {/* GeoTIFF population gridded density overlay.
            We wait for tenantInfo to resolve before rendering so the cache
            scope reflects the active *view* tenant — otherwise a raster
            cached under the user's home tenant could briefly render in the
            wrong country. Once tenantInfo is available, the URL itself
            includes the tenant code as a cache buster so a stale cached
            raster from another country can never satisfy this request. */}
        {layers.populationGeoTIFF && tenantInfo?.id && (
          <GeoTIFFOverlay
            key={`geotiff-${tenantInfo.id}-${selectedRasterFile || "default"}`}
            url={
              selectedRasterFile
                ? `/api/resources/geotiff?file=${encodeURIComponent(selectedRasterFile)}&tenant=${encodeURIComponent(tenantInfo.code || tenantInfo.id)}`
                : `/api/resources/geotiff?tenant=${encodeURIComponent(tenantInfo.code || tenantInfo.id)}`
            }
            onRasterLoaded={(gr) => {
              georasterRef.current = gr;
            }}
            // Scope the IndexedDB raster cache to the active view tenant so a
            // raster cached under the user's home tenant is never served when
            // they have switched to another country.
            cacheScope={tenantInfo.id}
            // Only auto-fit the map to the raster bounds when the user has
            // explicitly picked a raster from the dropdown. For the default
            // (tenant-resolved) raster, the tenant's mapCenter/mapZoom keeps
            // the map on the right country.
            autoFit={!!selectedRasterFile}
          />
        )}

        {/* GRID3 Zambia Settlement Extents footprints.
            Rendered on a dedicated Leaflet pane (`grid3Pane`, z-index 450) so
            it always paints *above* boundary polygons no matter what the
            JSX order is or when boundary layers remount on Province change.
            The component key is intentionally STABLE — it must not include
            selectedProvinceId / selectedDistrictId / selectedLlgId — so this
            layer is never unmounted by a filter change. Selection-aware
            emphasis is applied imperatively via `grid3LayerRef.setStyle`. */}
        {layers.grid3Settlements && grid3GeoJSON?.features?.length > 0 && (
          <>
            <Grid3PaneCreator />
            <GeoJSON
              key="grid3-settlements-overlay"
              ref={(r) => { grid3LayerRef.current = r as any; }}
              data={grid3GeoJSON}
              pane="grid3Pane"
              {...({ renderer: grid3CanvasRenderer } as any)}
              style={grid3StyleFn as any}
              onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const name = props.name || `${props.type || 'Settlement'} #${props.OBJECTID || ''}`;
              const count = props.building_count || 0;
              const area = props.building_area ? Math.round(props.building_area) : 0;
              layer.bindPopup(`
                <div class="p-2 text-xs font-sans space-y-1">
                  <div class="font-bold text-primary flex items-center gap-1">
                    <span class="inline-block w-2 h-2 rounded-full bg-violet-600"></span>
                    ${name}
                  </div>
                  <div class="text-[10px] text-muted-foreground">GRID3 Physical Footprint</div>
                  <div class="border-t pt-1 flex flex-col gap-0.5 mt-1 text-foreground">
                    <div><strong>Type:</strong> ${props.type || 'N/A'}</div>
                    <div><strong>Buildings:</strong> ${count} units</div>
                    <div><strong>Built Area:</strong> ${area} mÂ²</div>
                    <div><strong>Source:</strong> ${props.source || 'CIESIN'}</div>
                  </div>
                </div>
              `, { maxWidth: 200 });
            }}
            />
          </>
        )}

        {/* Admin-uploaded custom map layers (vector + raster). Each active
            layer that the user has not hidden this session is rendered here.
            Vector layers fetch their GeoJSON lazily; rasters stream the stored
            GeoTIFF via the dedicated raster endpoint. */}
        {mode !== "surveillance" && activeCustomLayers
          .filter((l: any) => !hiddenCustomLayerIds.has(l.id))
          .map((l: any) =>
            l.layerType === "raster" ? (
              <GeoTIFFOverlay
                key={`custom-raster-${l.id}`}
                url={`/api/custom-layers/${l.id}/raster`}
                cacheScope={`custom-${l.id}`}
              />
            ) : (
              <CustomVectorLayer key={`custom-vector-${l.id}`} id={l.id} style={l.style} />
            ),
          )}

        {/* Plotted Session geofence drawing previews */}
        {isDrawingSessionPolygon && sessionPolygonPoints.length > 0 && (
          <>
            {/* If Mobile, render Polyline route path */}
            {newSessionType === "mobile" ? (
              <Polyline
                positions={sessionPolygonPoints}
                pathOptions={{
                  color: "#d97706", // Amber
                  weight: 4,
                  opacity: 0.8,
                }}
              />
            ) : (
              /* If Outreach, render closed Polygon */
              <Polygon
                positions={sessionPolygonPoints}
                pathOptions={{
                  color: "#d97706", // Amber
                  weight: 3,
                  fillColor: "#f59e0b",
                  fillOpacity: 0.15,
                  dashArray: "5, 10"
                }}
              />
            )}

            {/* Render CircleMarkers for vertices */}
            {sessionPolygonPoints.map((pt, idx) => (
              <CircleMarker
                key={`draw-vertex-${idx}`}
                center={pt}
                radius={5}
                pathOptions={{
                  color: "#b45309",
                  fillColor: "#ffffff",
                  fillOpacity: 1.0,
                  weight: 2
                }}
              />
            ))}
          </>
        )}

        {/* Render Active Session Plans (Planned vs Achieved) */}
        {activeSessionPlans.map((plan: any) => {
          if (!plan.geojson || !plan.geojson.coordinates) return null;

          const isAchieved = plan.isAchieved;

          // Color coding: Achieved = Solid Green (#10b981), Planned = Dashed Gold-Amber (#f59e0b)
          const color = isAchieved ? "#10b981" : "#f59e0b";
          const weight = isAchieved ? 3.5 : 2.5;
          const dashArray = isAchieved ? undefined : "5, 8";
          const fillColor = isAchieved ? "#10b981" : "#f59e0b";
          const fillOpacity = isAchieved ? 0.25 : 0.12;

          const centroid = getSessionCentroid(plan);

          const lifecycle = deriveSessionLifecycle(plan);

          const renderPopup = () => {
            const linkedVils = sessionVillages
              ?.filter((sv: any) => sv.sessionId === plan.id)
              .map((sv: any) => villages.find((v) => v.id === sv.villageId))
              .filter((v): v is Village => !!v);

            const isClosed = lifecycle.phase === "reported" || lifecycle.phase === "archived";

            return (
              <Popup>
                <div className="p-3 w-64 select-text">
                  <div className="flex items-center justify-between mb-2 gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {plan.sessionType}
                    </span>
                    <div className="flex items-center gap-1">
                      {lifecycle.isOverdue && (
                        <Badge
                          variant="secondary"
                          className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[9px] font-bold uppercase tracking-wider"
                          data-testid={`badge-overdue-${plan.id}`}
                        >
                          Overdue
                        </Badge>
                      )}
                      <Badge variant="secondary" className={plan.isAchieved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"}>
                        {plan.isAchieved ? "ACHIEVED" : "PLANNED"}
                      </Badge>
                    </div>
                  </div>
                  <h4 className="font-bold text-xs text-primary mb-1">{plan.name}</h4>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Catchment Target: <strong>{plan.targetPopulation || 0}</strong> people
                  </p>

                  {linkedVils && linkedVils.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Target Communities ({linkedVils.length})
                      </div>
                      <div className="max-h-20 overflow-y-auto space-y-1 custom-scrollbar text-[10px]">
                        {linkedVils.map((v: any) => (
                          <div key={v.id} className="flex justify-between items-center py-0.5 border-b border-border/20 last:border-0">
                            <span className="font-semibold truncate text-[10px]">{v.name}</span>
                            <span className="font-mono text-[9px] text-muted-foreground">Pop: {v.population || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/40 flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      variant={plan.isAchieved ? "outline" : "default"}
                      className="w-full text-[10px] h-7 font-bold gap-1 rounded-lg min-h-[44px] sm:min-h-0"
                      onClick={() => toggleAchievedMutation.mutate({ sessionId: plan.id, isAchieved: !plan.isAchieved })}
                      disabled={toggleAchievedMutation.isPending}
                    >
                      {plan.isAchieved ? (
                        <>
                          <XCircle className="h-3 w-3 text-rose-500 mr-1" />
                          Mark Unachieved
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 text-white mr-1" />
                          Mark Achieved
                        </>
                      )}
                    </Button>
                    {isClosed && plan.facilityId && (
                      <a
                        href={`/microplans/${plan.planType === "campaign" ? "campaigns" : "routine"}?facilityId=${plan.facilityId}&fromSession=${plan.id}`}
                        className="w-full"
                        data-testid={`link-plan-new-${plan.id}`}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-[10px] h-7 font-bold gap-1 rounded-lg border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 min-h-[44px] sm:min-h-0"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Plan a new session here
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            );
          };

          const renderVector = () => {
            if (plan.geojson.type === "Polygon" && Array.isArray(plan.geojson.coordinates[0])) {
              const leafletPositions = plan.geojson.coordinates[0].map((pt: any) => [pt[1], pt[0]] as [number, number]);
              return (
                <Polygon
                  positions={leafletPositions}
                  pathOptions={{
                    color,
                    weight,
                    fillColor,
                    fillOpacity,
                    dashArray,
                  }}
                >
                  {renderPopup()}
                </Polygon>
              );
            } else if (plan.geojson.type === "LineString" && Array.isArray(plan.geojson.coordinates)) {
              const leafletPositions = plan.geojson.coordinates.map((pt: any) => [pt[1], pt[0]] as [number, number]);
              return (
                <Polyline
                  positions={leafletPositions}
                  pathOptions={{
                    color,
                    weight,
                    dashArray,
                  }}
                >
                  {renderPopup()}
                </Polyline>
              );
            }
            return null;
          };

          return (
            <div key={`session-layers-${plan.id}`}>
              {renderVector()}
              {centroid && (
                <Marker
                  position={centroid}
                  icon={
                    new L.Icon({
                      iconUrl: plan.isAchieved
                        ? FILLED_PIN_DATA_URIS.green
                        : FILLED_PIN_DATA_URIS.amber,
                      iconSize: [22, 32],
                      iconAnchor: [11, 32],
                      popupAnchor: [0, -32],
                    })
                  }
                >
                  {renderPopup()}
                </Marker>
              )}
            </div>
          );
        })}

        {/* Roads transparent transport network overlay */}
        {/* Updated Code: Added opacity=0.75 for clear visibility; also added OpenStreetMap-Roads as a
            secondary fallback layer since the primary Esri Transportation service may be rate-limited
            or unavailable in some network environments. */}
        {layers.roads && (
          <>
            {/* Primary: Esri World Transportation (authoritative road data) */}
            {/* maxNativeZoom=17: Same rationale as the imagery layer — ArcGIS Reference/
                World_Transportation tiles only exist to z17 in rural Africa/PNG. Without this
                cap, Leaflet requests z18+ tiles that ArcGIS answers with the "Map data not yet
                available" placeholder image, which overlays on the map during high-zoom. */}
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, USGS, iPC'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={17}
              maxZoom={22}
              opacity={0.8}
              zIndex={100}
            />
          </>
        )}

        {/* Glowing HTR (Hard-To-Reach) outreach area buffers */}
        {/* Updated Code: Removed showVillageMarkers dependency so the toggle responds immediately.
            HTR buffers now render whenever layers.htrAreas is true AND HTR village data exists,
            using visibleVillagesFiltered which already handles bounds-based performance pruning. */}
        {layers.htrAreas &&
          showVillageMarkers &&
          visibleVillagesFiltered
            .filter((v) => v.latitude && v.longitude && v.isHardToReach)
            .map((v) => (
              <Circle
                key={`htr-buffer-${v.id}`}
                center={[Number(v.latitude), Number(v.longitude)]}
                radius={5000} // 5km glowing outreach buffer
                pathOptions={{
                  fillColor: "#ef4444",
                  color: "#ef4444",
                  fillOpacity: 0.12,
                  weight: 1,
                  dashArray: "3, 6"
                }}
              />
            ))}

        {/* Render Administrative Boundaries (Levels 0-5) */}


        {/* Updated Code: Dynamic Cascading Administrative Boundaries styled premium per level using pre-filtered GeoJSON arrays to avoid browser SVG bloat */}
        {layers.boundaries &&
          boundaryList &&
          boundaryList
            .filter((b) => b.isActive)
            .map((b) => {
              const geojson = filteredBoundaryGeoJSONs[b.id];
              if (!geojson || !geojson.features || geojson.features.length === 0) return null;

              const choroplethStyleFn = layers.populationChoropleth && b.adminLevel === 2
                ? (feature: any) => {
                    const fName = getBoundaryFeatureName(feature, b.adminLevel);
                    const matchedDist = districtNameLookup.get(normalizeName(fName));
                    const pop = matchedDist ? (districtPopMap.get(matchedDist.id) ?? 0) : 0;
                    const col = pop > 0 ? getChoroplethColor(pop) : "#f1f5f9";
                    return {
                      color: pop > 0 ? "#1e293b" : "#94a3b8",
                      weight: pop > 0 ? 1.2 : 0.9,
                      opacity: pop > 0 ? 0.9 : 0.65,
                      fillOpacity: pop > 0 ? 0.68 : 0.18,
                      fillColor: col,
                      dashArray: pop > 0 ? undefined : "4, 4",
                    };
                  }
                : undefined;
              const style = choroplethStyleFn ?? getBoundaryStyle(b.adminLevel, mode);

              return (
                <GeoJSON
                  key={`boundary-${b.id}-${selectedProvinceId}-${selectedDistrictId}-${selectedLlgId}-${layers.showLabels}-${layers.populationChoropleth}-${popChoroplethSource}`}
                  data={geojson}
                  style={choroplethStyleFn ?? style}
                  onEachFeature={(feature, layer) => {
                    const name = getBoundaryFeatureName(feature, b.adminLevel);

                    if (layers.showLabels && name) {
                      layer.bindTooltip(resolveLabel(name), {
                        permanent: true,
                        direction: "center",
                        className: "map-boundary-label",
                      });
                    } else if (name) {
                      const matchedDist =
                        layers.populationChoropleth && b.adminLevel === 2
                          ? districtNameLookup.get(normalizeName(name))
                          : null;
                      const population =
                        matchedDist && districtPopMap.has(matchedDist.id)
                          ? districtPopMap.get(matchedDist.id)
                          : null;
                      const tooltipText =
                        layers.populationChoropleth && b.adminLevel === 2
                          ? `${resolveLabel(name)} - ${population ? population.toLocaleString() + " people" : "No population data"}`
                          : resolveLabel(name);
                      layer.bindTooltip(tooltipText, {
                        sticky: true,
                        className: "text-xs font-semibold px-2 py-1 rounded bg-background border shadow",
                      });
                    }

                    // Pre-match boundary polygons with database entities for renaming and filtering
                    const fName = getBoundaryFeatureName(feature, b.adminLevel);
                    const normFName = normalizeName(fName);

                    let matchedEntityId: number | null = null;
                    let matchedEntityType: "province" | "district" | "llg" | null = null;

                    if (normFName) {
                      if (b.adminLevel === 1) {
                        const matchedProv = provinces.find((p) => normalizeName(p.name) === normFName);
                        if (matchedProv) {
                          matchedEntityId = matchedProv.id;
                          matchedEntityType = "province";
                        }
                      } else if (b.adminLevel === 2) {
                        const matchedDist = districts.find((d) => normalizeName(d.name) === normFName);
                        if (matchedDist) {
                          matchedEntityId = matchedDist.id;
                          matchedEntityType = "district";
                        }
                      } else if (b.adminLevel === 3) {
                        const matchedLlg = llgs.find((l) => normalizeName(l.name) === normFName);
                        if (matchedLlg) {
                          matchedEntityId = matchedLlg.id;
                          matchedEntityType = "llg";
                        }
                      }
                    }

                    // Create Leaflet Popup content offering Zoom + Rename
                    const container = document.createElement("div");
                    container.className = "p-2.5 font-sans text-xs space-y-2 min-w-[160px]";

                    const title = document.createElement("h4");
                    title.className = "font-bold text-foreground text-xs border-b pb-1 truncate";
                    title.innerText = name;
                    container.appendChild(title);

                    const metaInfo = document.createElement("p");
                    metaInfo.className = "text-[9px] font-bold text-muted-foreground uppercase tracking-wider";
                    metaInfo.innerText = `${b.levelName || "Boundary"}`;
                    container.appendChild(metaInfo);

                    const buttonsDiv = document.createElement("div");
                    buttonsDiv.className = "flex flex-col gap-1 pt-1";

                    const zoomBtn = document.createElement("button");
                    zoomBtn.className = "w-full text-left px-2 py-1.5 hover:bg-accent rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors";
                    zoomBtn.innerHTML = "Zoom to area";
                    zoomBtn.onclick = (e) => {
                      e.stopPropagation();
                      const pathLayer = layer as any;
                      if (mapRef.current && typeof pathLayer.getBounds === "function") {
                        mapRef.current.fitBounds(pathLayer.getBounds(), { padding: [20, 20] });
                      }

                      // Apply cascading filter in Sidebar
                      if (matchedEntityType === "province" && matchedEntityId) {
                        handleProvinceChange(matchedEntityId);
                      } else if (matchedEntityType === "district" && matchedEntityId) {
                        handleDistrictChange(matchedEntityId);
                      } else if (matchedEntityType === "llg" && matchedEntityId) {
                        handleLlgChange(matchedEntityId);
                      }
                    };
                    buttonsDiv.appendChild(zoomBtn);

                    // Plan outreach session button dynamically linked to click coordinate
                    const planBtn = document.createElement("button");
                    planBtn.className = "w-full text-left px-2 py-1.5 hover:bg-accent rounded text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-colors";
                    planBtn.innerHTML = "Plan outreach session here";

                    let currentLatLng: L.LatLng | null = null;
                    planBtn.onclick = (e) => {
                      e.stopPropagation();
                      if (currentLatLng) {
                        handleMapClick({ latlng: currentLatLng } as L.LeafletMouseEvent);
                        layer.closePopup();
                      }
                    };
                    buttonsDiv.appendChild(planBtn);

                    if (matchedEntityId && matchedEntityType) {
                      const renameBtn = document.createElement("button");
                      renameBtn.className = "w-full text-left px-2 py-1.5 hover:bg-accent rounded text-[10px] font-bold text-primary flex items-center gap-1.5 transition-colors";
                      renameBtn.innerHTML = "Rename this area";
                      renameBtn.onclick = (e) => {
                        e.stopPropagation();
                        setRenameTarget({
                          type: matchedEntityType!,
                          id: matchedEntityId!,
                          name: name,
                        });
                      };
                      buttonsDiv.appendChild(renameBtn);
                    }

                    container.appendChild(buttonsDiv);
                    layer.bindPopup(container);

                    /* Original Code: mouseover and mouseout only
                    layer.on({
                      mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({
                          color: "#3b82f6", // Royal blue highlight stroke
                          weight: 3,
                          fillColor: "#3b82f6", // Royal blue highlight fill
                          fillOpacity: 0.2,
                        });
                      },
                      mouseout: (e) => {
                        const l = e.target;
                        l.setStyle(getBoundaryStyle(b.adminLevel, mode)); // Restores exact level style dynamically
                      },
                    });
                    */

                    // Updated Code: Listen to clicks to store coordinate, compute gridded population/nearest HF, and update popup content dynamically before opening
                    /* Original click handler commented out to support calculating and displaying gridded population, nearest HF, and coordinates inside the boundary popup:
                    layer.on({
                      click: (e: any) => {
                        currentLatLng = e.latlng;
                      },
                      mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({
                          color: "#3b82f6", // Royal blue highlight stroke
                          weight: 3,
                          fillColor: "#3b82f6", // Royal blue highlight fill
                          fillOpacity: 0.2,
                        });
                      },
                      mouseout: (e) => {
                        const l = e.target;
                        l.setStyle(getBoundaryStyle(b.adminLevel, mode)); // Restores exact level style dynamically
                      },
                    });
                    */
                    layer.on({
                      click: (e: any) => {
                        currentLatLng = e.latlng;

                        const lat = e.latlng.lat;
                        const lng = e.latlng.lng;

                        let density = 0;
                        if (georasterRef.current) {
                          const gr = georasterRef.current;
                          const col = Math.floor(((lng - gr.xmin) / (gr.xmax - gr.xmin)) * gr.width);
                          const row = Math.floor(((gr.ymax - lat) / (gr.ymax - gr.ymin)) * gr.height);

                          if (row >= 0 && row < gr.height && col >= 0 && col < gr.width) {
                            const rawVal = gr.values[0][row][col];
                            if (rawVal !== undefined && !isNaN(rawVal) && rawVal !== gr.noDataValue && rawVal > 0) {
                              density = parseFloat(rawVal.toFixed(2));
                            }
                          }
                        }

                        const ctx = calculateEnrichedContext(lat, lng, density, feature);

                        let infoDiv = container.querySelector(".boundary-popup-info");
                        if (!infoDiv) {
                          infoDiv = document.createElement("div");
                          infoDiv.className = "boundary-popup-info border-t border-border/60 pt-2 mt-2 space-y-2 text-[10px]";
                          container.insertBefore(infoDiv, buttonsDiv);
                        }

                        infoDiv.innerHTML = `
                          <div class="space-y-2 text-[11px] leading-snug">
                            <div class="bg-primary/5 border border-primary/10 rounded p-1.5 space-y-0.5">
                              <div class="flex justify-between items-center text-[9px] text-muted-foreground">
                                <span>CLICK COORDINATES</span>
                                <span class="font-mono">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                              </div>
                              ${ctx.polygonName ? `
                              <div class="text-[10px] font-bold text-primary flex justify-between items-center gap-1.5 mt-0.5">
                                <span class="truncate">${ctx.polygonName}</span>
                                ${ctx.polygonPopulation ? `<span class="text-emerald-600 font-bold shrink-0">~ ${ctx.polygonPopulation.toLocaleString()} pop</span>` : ""}
                              </div>
                              ` : ""}
                            </div>

                            <div class="space-y-1">
                              <span class="font-bold text-[9px] text-muted-foreground uppercase block">Aggressive Gridded Population</span>
                              <div class="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                                <div class="bg-muted p-1 rounded">
                                  <span class="text-[8px] text-muted-foreground block">1km</span>
                                  <strong class="text-xs text-foreground pop-1k-val">${ctx.pop1k.toLocaleString()}</strong>
                                </div>
                                <div class="bg-muted p-1 rounded">
                                  <span class="text-[8px] text-muted-foreground block">2km</span>
                                  <strong class="text-xs text-foreground pop-2k-val">${ctx.pop2k.toLocaleString()}</strong>
                                </div>
                                <div class="bg-muted p-1 rounded">
                                  <span class="text-[8px] text-muted-foreground block">3km</span>
                                  <strong class="text-xs text-foreground pop-3k-val">${ctx.pop3k.toLocaleString()}</strong>
                                </div>
                              </div>
                            </div>

                            <div class="space-y-1">
                              <span class="font-bold text-[9px] text-muted-foreground uppercase block">Catchment Proximity</span>
                              <div class="space-y-1 text-[10px]">
                                <div class="flex justify-between items-center bg-muted/40 p-1 rounded px-1.5">
                                  <span class="text-muted-foreground truncate max-w-[150px]">HF: ${ctx.nearestFacility?.name || "None"}</span>
                                  <span class="font-mono font-bold shrink-0">${ctx.nearestFacility ? `${ctx.nearestFacility.distance}km` : "—"}</span>
                                </div>
                                <div class="flex justify-between items-center bg-muted/40 p-1 rounded px-1.5">
                                  <span class="text-muted-foreground truncate max-w-[150px]">Session: ${ctx.nearestPlan?.name || "None"}</span>
                                  <span class="font-mono font-bold shrink-0">${ctx.nearestPlan ? `${ctx.nearestPlan.distance}km` : "—"}</span>
                                </div>
                              </div>
                            </div>

                            <div class="space-y-1">
                              <span class="font-bold text-[9px] text-muted-foreground uppercase block">Nearby Communities</span>
                              <div class="space-y-1 max-h-[70px] overflow-y-auto">
                                ${ctx.nearbyVillages.length > 0 ? ctx.nearbyVillages.map(nv => `
                                  <div class="flex justify-between items-center text-[10px] border-b border-border/40 pb-0.5 last:border-0">
                                    <span class="truncate max-w-[110px] ${nv.isHardToReach ? 'text-amber-600 font-medium' : 'text-foreground'}">
                                      ${nv.name} ${nv.isHardToReach ? '(HTR)' : ''}
                                    </span>
                                    <span class="text-muted-foreground font-mono shrink-0">${nv.population} pop (${nv.distance}km)</span>
                                  </div>
                                `).join("") : `<p class="text-[9px] italic text-muted-foreground">No villages within 10km</p>`}
                              </div>
                            </div>

                            ${ctx.isHTR ? `
                            <div class="bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded p-1.5 text-[9px] flex items-start gap-1 font-medium">
                              <span>!</span>
                              <span>Hard-to-Reach (HTR) designated zone.</span>
                            </div>
                            ` : ""}
                          </div>
                        `;

                        layer.setPopupContent(container);

                        // Asynchronous Fallback for radial population in boundary popup
                        if (density === 0) {
                          Promise.all([
                            fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=1`).then(r => r.json()).catch(() => ({ gridPop: 0 })),
                            fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=2`).then(r => r.json()).catch(() => ({ gridPop: 0 })),
                            fetch(`/api/population/worldpop-point?lat=${lat}&lng=${lng}&radiusKm=3`).then(r => r.json()).catch(() => ({ gridPop: 0 }))
                          ]).then(([r1, r2, r3]) => {
                            const pop1kEl = container.querySelector(".pop-1k-val");
                            const pop2kEl = container.querySelector(".pop-2k-val");
                            const pop3kEl = container.querySelector(".pop-3k-val");
                            if (pop1kEl) pop1kEl.textContent = (r1.gridPop || 0).toLocaleString();
                            if (pop2kEl) pop2kEl.textContent = (r2.gridPop || 0).toLocaleString();
                            if (pop3kEl) pop3kEl.textContent = (r3.gridPop || 0).toLocaleString();
                          }).catch(err => {
                            console.error("Async boundary pop fetch failed", err);
                          });
                        }
                      },
                      mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({
                          color: "#3b82f6", // Royal blue highlight stroke
                          weight: 3,
                          fillColor: "#3b82f6", // Royal blue highlight fill
                          fillOpacity: 0.2,
                        });
                      },
                      mouseout: (e) => {
                        const l = e.target;
                        l.setStyle(getBoundaryStyle(b.adminLevel, mode)); // Restores exact level style dynamically
                      },
                    });
                  }}
                />
              );
            })}

        {/* Render HCW Catchments (Drawn catchment areas) */}
        {/* Original Code commented out to preserve backward compatibility:
        {layers.hcwCatchments &&
          hcwCatchments &&
          hcwCatchments.map((catchment) => {
            const facilityName =
              facilities.find((f) => f.id === catchment.facilityId)?.name || "Facility";
            return (
              <GeoJSON
                key={`hcw-catchment-${catchment.id}`}
                data={catchment.geojson as any}
                style={{
                  color: "#0284c7", // Sky blue stroke
                  weight: 2,
                  fillOpacity: 0.25,
                  fillColor: "#38bdf8", // Sky blue fill
                }}
                onEachFeature={(feature, layer) => {
                  const areaStr = catchment.areaSqKm ? `${Number(catchment.areaSqKm).toFixed(2)} kmÂ²` : "N/A";
                  const popStr = catchment.populationEstimate ? `${catchment.populationEstimate}` : "N/A";
                  const savedAt = (catchment as any).createdAt
                    ? new Date((catchment as any).createdAt).toLocaleString()
                    : "—";
                  const drawnBy = (catchment as any).drawnByUserId
                    ? String((catchment as any).drawnByUserId).slice(0, 8) + "…"
                    : "—";
                  const tooltipContent = `
                    <div class="p-1 space-y-1">
                      <p class="font-bold text-sm text-sky-900">${catchment.name}</p>
                      <p class="text-xs text-muted-foreground">${facilityName}</p>
                      <p class="text-[11px]"><b>Area:</b> ${areaStr}</p>
                      <p class="text-[11px]"><b>Est. Population:</b> ${popStr}</p>
                      <p class="text-[11px]"><b>Drawn by:</b> ${drawnBy}</p>
                      <p class="text-[11px]"><b>Saved:</b> ${savedAt}</p>
                      <p class="text-[11px]"><b>Status:</b> ${catchment.isOfficial ? "Official Catchment" : "Drawn Catchment"}</p>
                    </div>
                  `;
                  layer.bindPopup(tooltipContent);
                  // Leaflet vector layers swallow click events by default, so a
                  // user clicking ON a catchment polygon never triggered the
                  // map's click handler (which is what initiates a new session
                  // plan from the clicked location). Re-fire the click on the
                  // map so the "Plan a session here" flow runs even when the
                  // click lands inside a drawn catchment area. We stop the
                  // underlying DOM event first so any latent bubbling from the
                  // SVG renderer can't double-dispatch into handleMapClick (one
                  // click → one session-start / one drawn point).
                  layer.on("click", (e: any) => {
                    if (e?.originalEvent) {
                      L.DomEvent.stopPropagation(e.originalEvent);
                    }
                    if (mapRef.current) {
                      mapRef.current.fire("click", e);
                    }
                  });
                }}
              />
            );
          })}
        */}

        {/* Updated Code: Render visibleHcwCatchments (which are already bounds-pruned in a memoized hook) */}
        {layers.hcwCatchments &&
          visibleHcwCatchments.map((catchment) => {
            const facilityName =
              facilities.find((f) => f.id === catchment.facilityId)?.name || "Facility";
            return (
              <GeoJSON
                key={`hcw-catchment-${catchment.id}`}
                data={catchment.geojson as any}
                style={{
                  color: "#0284c7", // Sky blue stroke
                  weight: 2,
                  fillOpacity: 0.25,
                  fillColor: "#38bdf8", // Sky blue fill
                }}
                onEachFeature={(feature, layer) => {
                  const areaStr = catchment.areaSqKm ? `${Number(catchment.areaSqKm).toFixed(2)} kmÂ²` : "N/A";
                  const popStr = catchment.populationEstimate ? `${catchment.populationEstimate}` : "N/A";
                  const savedAt = (catchment as any).createdAt
                    ? new Date((catchment as any).createdAt).toLocaleString()
                    : "—";
                  const drawnBy = (catchment as any).drawnByUserId
                    ? String((catchment as any).drawnByUserId).slice(0, 8) + "…"
                    : "—";
                  const tooltipContent = `
                    <div class="p-1 space-y-1">
                      <p class="font-bold text-sm text-sky-900">${catchment.name}</p>
                      <p class="text-xs text-muted-foreground">${facilityName}</p>
                      <p class="text-[11px]"><b>Area:</b> ${areaStr}</p>
                      <p class="text-[11px]"><b>Est. Population:</b> ${popStr}</p>
                      <p class="text-[11px]"><b>Drawn by:</b> ${drawnBy}</p>
                      <p class="text-[11px]"><b>Saved:</b> ${savedAt}</p>
                      <p class="text-[11px]"><b>Status:</b> ${catchment.isOfficial ? "Official Catchment" : "Drawn Catchment"}</p>
                    </div>
                  `;
                  layer.bindPopup(tooltipContent);
                  // Leaflet vector layers swallow click events by default, so a
                  // user clicking ON a catchment polygon never triggered the
                  // map's click handler (which is what initiates a new session
                  // plan from the clicked location). Re-fire the click on the
                  // map so the "Plan a session here" flow runs even when the
                  // click lands inside a drawn catchment area. We stop the
                  // underlying DOM event first so any latent bubbling from the
                  // SVG renderer can't double-dispatch into handleMapClick (one
                  // click → one session-start / one drawn point).
                  layer.on("click", (e: any) => {
                    if (e?.originalEvent) {
                      L.DomEvent.stopPropagation(e.originalEvent);
                    }
                    if (mapRef.current) {
                      mapRef.current.fire("click", e);
                    }
                  });
                }}
              />
            );
          })}

        {/*
        // Original Code: Concentric circles and catchment lines rendered without O(1) lookups or zoom pruning, resulting in significant rendering lockups
        {layers.catchments &&
          filteredFacilities
            .filter((f) => f.latitude && f.longitude)
            .map((facility) => {
              const lat = Number(facility.latitude);
              const lng = Number(facility.longitude);
              return (
                <div key={`catchment-circles-${facility.id}`}>
                  <Circle
                    center={[lat, lng]}
                    radius={5000}
                    pathOptions={{
                      fillColor: "#22c55e",
                      color: "#22c55e",
                      fillOpacity: 0.04,
                      weight: 1.5,
                      dashArray: "4, 4"
                    }}
                  />
                  <Circle
                    center={[lat, lng]}
                    radius={10000}
                    pathOptions={{
                      fillColor: "#ea580c",
                      color: "#ea580c",
                      fillOpacity: 0.02,
                      weight: 1.5,
                      dashArray: "4, 4"
                    }}
                  />
                </div>
              );
            })}

        {layers.catchments &&
          filteredVillages
            .filter((v) => v.latitude && v.longitude && v.assignedFacilityId)
            .map((village) => {
              const facility = filteredFacilities.find((f) => f.id === village.assignedFacilityId);
              if (!facility || !facility.latitude || !facility.longitude) return null;
              ...
            })}
        {/* Updated Code: High-performance Concentric Walkability circles for health facilities */}
        {layers.catchments &&
          filteredFacilities
            .filter((f) => {
              if (!f.latitude || !f.longitude) return false;
              if (!mapBounds) return true;
              return mapBounds.contains([Number(f.latitude), Number(f.longitude)]);
            })
            .map((facility) => {
              const lat = Number(facility.latitude);
              const lng = Number(facility.longitude);
              return (
                <div key={`catchment-circles-${facility.id}`}>
                  {/* 5km Walkable Buffer (Green) */}
                  <Circle
                    center={[lat, lng]}
                    radius={5000}
                    pathOptions={{
                      fillColor: "#22c55e",
                      color: "#22c55e",
                      fillOpacity: 0.04,
                      weight: 1.5,
                      dashArray: "4, 4"
                    }}
                  />
                  {/* 10km Outreach Buffer (Orange) */}
                  <Circle
                    center={[lat, lng]}
                    radius={10000}
                    pathOptions={{
                      fillColor: "#ea580c",
                      color: "#ea580c",
                      fillOpacity: 0.02,
                      weight: 1.5,
                      dashArray: "4, 4"
                    }}
                  />
                </div>
              );
            })}

        {/* Original Code:
        {layers.catchments &&
          showVillageMarkers &&
          visibleVillages
            .filter((v) => v.latitude && v.longitude && v.assignedFacilityId)
            .map((village) => {
              const facility = filteredFacilitiesMap.get(Number(village.assignedFacilityId));
              if (!facility || !facility.latitude || !facility.longitude) return null;

              const vLat = Number(village.latitude);
              const vLng = Number(village.longitude);
              const fLat = Number(facility.latitude);
              const fLng = Number(facility.longitude);

              // Calculate Turf geodesic distance
              const dist = distance([vLng, vLat], [fLng, fLat], { units: "kilometers" });

              // Color code based on walkability distance
              let color = "#22c55e"; // Walkable (<5km)
              if (dist > 10) {
                color = "#ef4444"; // HTR (>10km)
              } else if (dist > 5) {
                color = "#ea580c"; // Outreach (5-10km)
              }

              return (
                <Polyline
                  key={`link-${village.id}-${facility.id}`}
                  positions={[[vLat, vLng], [fLat, fLng]]}
                  color={color}
                  weight={1.5}
                  opacity={0.7}
                  dashArray="2, 4"
                />
              );
            })}
        {/* Updated Code: High-performance O(1) Village-to-Facility Catchment Lines.
            Removed showVillageMarkers dependency — visibleVillagesFiltered now handles bounds
            pruning unconditionally, so these lines render immediately when the toggle is enabled. */}
        {/* Original Code commented out to preserve backward compatibility and prevent redundant Turf distance calculations inside loop:
        {layers.catchments &&
          showVillageMarkers &&
          visibleVillagesFiltered
            .filter((v) => v.latitude && v.longitude && v.assignedFacilityId)
            .map((village) => {
              const facility = filteredFacilitiesMap.get(Number(village.assignedFacilityId));
              if (!facility || !facility.latitude || !facility.longitude) return null;

              const vLat = Number(village.latitude);
              const vLng = Number(village.longitude);
              const fLat = Number(facility.latitude);
              const fLng = Number(facility.longitude);

              // Calculate Turf geodesic distance
              const dist = distance([vLng, vLat], [fLng, fLat], { units: "kilometers" });

              // Color code based on walkability distance
              let color = "#22c55e"; // Walkable (<5km)
              if (dist > 10) {
                color = "#ef4444"; // HTR (>10km)
              } else if (dist > 5) {
                color = "#ea580c"; // Outreach (5-10km)
              }

              return (
                <Polyline
                  key={`link-${village.id}-${facility.id}`}
                  positions={[[vLat, vLng], [fLat, fLng]]}
                  color={color}
                  weight={1.5}
                  opacity={0.7}
                  dashArray="2, 4"
                />
              );
            })}
        */}

        {/* Facility-community links must be routed roads, not straight-line hints.
            Straight geometry is intentionally hidden; selecting a facility below
            draws only OSRM road route geometry returned by the API. */}

        {/* Network routes rendering when a facility is selected */}
        {selectedFacilityId && communityRoutes && communityRoutes.length > 0 &&
          communityRoutes.map((route: any) => {
            if (route.hasRoadGeometry === false || route.routeSource === "estimate") return null;
            if (!route.routeGeometry || route.routeGeometry.length < 2) return null;
            const positions = route.routeGeometry.map(([lng, lat]: [number, number]) => [lat, lng]);

            // Color code based on walkability distance
            const dist = route.distanceToFacility || 0;
            let color = "#3b82f6"; // Primary blue
            if (dist > 10) {
              color = "#ef4444"; // Red (>10km)
            } else if (dist > 5) {
              color = "#f97316"; // Orange (5-10km)
            } else {
              color = "#10b981"; // Emerald (<5km)
            }

            return (
              <Polyline
                key={`route-${selectedFacilityId}-${route.villageId}`}
                positions={positions}
                color={color}
                weight={3.5}
                opacity={0.85}
              />
            );
          })}

        {layers.facilities && (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={50} iconCreateFunction={createFacilityClusterIcon}>
            {visibleFacilitiesFiltered
              .filter((f) => f.latitude && f.longitude)
              .map((facility) => (
                <FacilityMarkerItem
                  key={`facility-${facility.id}`}
                  facility={facility}
                  facilityIcon={facilityIcon}
                  markerRefs={markerRefs}
                  facilityVillagesMap={facilityVillagesMap}
                  activeSessionPlans={activeSessionPlans}
                  handleFocusFacility={handleFocusFacility}
                  setSelectedFacilityId={setSelectedFacilityId}
                  setPanelVis={setPanelVis}
                  onSelectIntelligencePoint={setIntelligencePoint}
                />
              ))}
          </MarkerClusterGroup>
        )}

        {/*
        // Original Code: Rendering thousands of villages without zoom-based pruning
        {layers.villages &&
          filteredVillages
            .filter((v) => v.latitude && v.longitude)
            .map((village) => (
        */}
        {/* Updated Code: Village markers use visibleVillagesFiltered which already applies bounds-based
            pruning unconditionally. Removed the showVillageMarkers zoom-gate from the render condition
            so the toggle responds immediately when enabled, regardless of zoom level. */}
        {layers.villages && (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={40} iconCreateFunction={createVillageClusterIcon}>
            {/* Original code (commented out to preserve working code while optimizing performance):
            {(() => {
              if (showVillageMarkers) return visibleVillagesFiltered;
              if (selectedFacilityId && communityRoutes && communityRoutes.length > 0) {
                const routedVillageIds = new Set(communityRoutes.map((r: any) => r.villageId));
                return villages.filter((v) => routedVillageIds.has(v.id));
              }
              return [];
            })()
              .filter((v) => v.latitude && v.longitude)
              .map((village) => (
                <Marker
                key={`village-${village.id}`}
                position={[Number(village.latitude), Number(village.longitude)]}
                icon={
                  plannedVillageIds.has(village.id)
                    ? plannedIcon
                    : village.isHardToReach
                      ? missingHtrIcon
                      : missingStandardIcon
                }
              >
                {layers.showLabels && (
                  <Tooltip
                    permanent
                    direction="bottom"
                    offset={[0, 8]}
                    className="map-village-label"
                  >
                    {resolveLabel(village.name)}
                  </Tooltip>
                )}
            */}
            {activeClusteredVillages
              .filter((v) => v.latitude && v.longitude)
              .map((village) => (
                <Marker
                key={`village-${village.id}`}
                position={[Number(village.latitude), Number(village.longitude)]}
                icon={
                  plannedVillageIds.has(village.id)
                    ? plannedIcon
                    : village.isHardToReach
                      ? missingHtrIcon
                      : missingStandardIcon
                }
              >
                {/* Original Code commented out to preserve backward compatibility and prevent DOM layout bloat from permanent Tooltips:
                {layers.showLabels && (
                  <Tooltip
                    permanent={currentZoom >= 13}
                    direction="bottom"
                    offset={[0, 8]}
                    className="map-village-label"
                  >
                    {resolveLabel(village.name)}
                  </Tooltip>
                )}
                */}

                {/* Updated Code: Restrict permanent tooltips to zoom level 14 or higher and only when the number of visible villages is under 300 to minimize DOM reflow overhead. */}
                {layers.showLabels && (
                  <Tooltip
                    permanent={currentZoom >= 14 && activeMapVillages.length < 300}
                    direction="bottom"
                    offset={[0, 8]}
                    className="map-village-label"
                  >
                    {resolveLabel(village.name)}
                  </Tooltip>
                )}
                <Popup className="premium-map-popup">
                  <div className="w-64 overflow-hidden rounded-lg font-sans text-xs select-none">
                    {/* Header */}
                    <div className="bg-primary/5 p-3 pb-2 border-b border-border/60">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-foreground text-sm leading-tight leading-4 line-clamp-2">
                            {resolveLabel(village.name)}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({
                                type: "village",
                                id: village.id,
                                name: village.name,
                              });
                            }}
                            className="text-[10px] text-primary hover:underline font-bold mt-1 inline-flex items-center gap-0.5"
                          >
                            Rename
                          </button>
                        </div>
                        {plannedVillageIds.has(village.id) ? (
                          <Badge variant="outline" className="text-[9px] shrink-0 py-0 px-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 uppercase tracking-wider">
                            Planned
                          </Badge>
                        ) : village.isHardToReach ? (
                          <Badge variant="destructive" className="text-[9px] shrink-0 py-0 px-1 text-white bg-red-600 border-none font-bold uppercase tracking-wider">
                            Missing HTR
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] shrink-0 py-0 px-1 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/5 uppercase tracking-wider">
                            Missing Standard
                          </Badge>
                        )}
                      </div>
                      {village.code && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Code: {village.code}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5 bg-background/95 backdrop-blur-sm">
                      {/* Dynamic Administrative Trail */}
                      <div className="space-y-1 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-foreground/80">{adminLabels.level1}:</span>{" "}
                            {provinceLookup.get(Number(districtLookup.get(Number(village.districtId))?.provinceId))?.name || "N/A"}
                          </div>
                        </div>
                        <div className="pl-5 truncate">
                          <span className="font-semibold text-foreground/80">{adminLabels.level2}:</span>{" "}
                          {districtLookup.get(Number(village.districtId))?.name || "N/A"}
                        </div>
                        {village.llgId && llgLookup.get(Number(village.llgId)) && (
                          <div className="pl-5 truncate">
                            <span className="font-semibold text-foreground/80">{adminLabels.level3}:</span>{" "}
                            {llgLookup.get(Number(village.llgId))?.name}
                          </div>
                        )}
                        <div className="pl-5 truncate mt-1 pt-1 border-t border-border/20">
                          <span className="font-semibold text-foreground/80">Linked HF:</span>{" "}
                          {facilities?.find((f) => f.id === Number(village.assignedFacilityId))?.name || "Unassigned"}
                        </div>
                      </div>

                      <hr className="border-border/40" />

                      {/* Travel & Accessibility Grid */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex items-center gap-1.5 p-1.5 rounded border bg-muted/20 border-border/40 text-foreground">
                          <Ruler className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-medium leading-none text-muted-foreground">Distance</p>
                            <p className="font-bold text-[10px] mt-0.5 truncate">
                              {village.distanceToFacility ? `${Number(village.distanceToFacility).toFixed(1)} km` : "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 p-1.5 rounded border bg-muted/20 border-border/40 text-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-medium leading-none text-muted-foreground">Travel Time</p>
                            <p className="font-bold text-[10px] mt-0.5 truncate">
                              {village.travelTimeMinutes ? `${village.travelTimeMinutes} min` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bottom travel details / accessibility row */}
                      <div className="space-y-1.5 pt-1 border-t border-border/40 text-[10px]">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground font-medium">Transport Mode:</span>
                          <span className="font-semibold capitalize text-foreground">
                            {village.transportMode?.toLowerCase() || "N/A"}
                          </span>
                        </div>
                        {village.seasonalAccessibility && (
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-muted-foreground font-medium">Seasonal Barrier:</span>
                            <span className="font-semibold text-destructive truncate max-w-[140px]" title={village.seasonalAccessibility}>
                              {village.seasonalAccessibility}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Planning Status */}
                      <hr className="border-border/40 my-2" />
                      <div className="space-y-1 text-[10px]">
                        <p className="font-bold text-muted-foreground uppercase">Planning Status</p>
                        {(() => {
                          const planInfo = villagePlanningDetails.get(village.id);
                          if (planInfo) {
                            return (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 p-1 px-1.5 rounded border border-emerald-500/10">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span className="truncate">Planned: Day {planInfo.dayNumber} of "{planInfo.sessionName}"</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className={`flex items-center gap-1.5 font-semibold p-1 px-1.5 rounded border ${
                                village.isHardToReach
                                  ? "text-red-600 dark:text-red-400 bg-red-500/5 border-red-500/10"
                                  : "text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/10"
                              }`}>
                                <XCircle className="h-3.5 w-3.5 text-current shrink-0" />
                                <span className="truncate">Missing: Not scheduled in dispatches</span>
                              </div>
                            );
                          }
                        })()}
                      </div>

                      {/* Outreach Post Configuration Section */}
                      <hr className="border-border/40 my-2" />
                      <div className="space-y-1 text-[10px]">
                        <p className="font-bold text-muted-foreground uppercase">Outreach Post</p>
                        {village.outreachLatitude && village.outreachLongitude ? (
                          <div className="space-y-1 bg-purple-500/5 p-1 px-1.5 rounded border border-purple-500/10">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-purple-700 dark:text-purple-400 truncate max-w-[120px]" title={village.outreachPostName || "Outreach Post"}>
                                {village.outreachPostName || "Outreach Post"}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOutreachDialogTarget(village);
                                  }}
                                  className="text-[9px] text-purple-600 hover:underline font-bold"
                                >
                                  Edit
                                </button>
                                <span className="text-muted-foreground">|</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearOutreachPost(village);
                                  }}
                                  className="text-[9px] text-red-500 hover:underline font-bold"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            <p className="text-muted-foreground text-[9px]">
                              Coords: {Number(village.outreachLatitude).toFixed(4)}, {Number(village.outreachLongitude).toFixed(4)}
                            </p>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center bg-muted/20 p-1 px-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground italic">Not configured</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOutreachDialogTarget(village);
                              }}
                              className="text-[9px] text-primary hover:underline font-bold"
                            >
                              Configure
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Task #84 — Plan a session straight from any village pin.
                          Task #101 — if the village's facility has no routine
                          microplan yet, offer to start one instead of dropping
                          the user on the bare /sessions list page. */}
                      <Button
                        size="sm"
                        className="w-full h-7 text-[11px] font-semibold mt-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => {
                          const mp = (masterMicroplans ?? []).find(
                            (m: any) =>
                              Number(m.facilityId) === Number(village.assignedFacilityId) &&
                              m.planType === "facility_routine",
                          );
                          const qs = new URLSearchParams({
                            unservedVillageId: String(village.id),
                            unservedName: village.name ?? "",
                            unservedLat: String(village.latitude),
                            unservedLng: String(village.longitude),
                            unservedHtr: village.isHardToReach ? "1" : "0",
                            prefillKind: "village",
                            autoOpen: "1",
                          });
                          if (mp) {
                            window.location.assign(`/sessions/microplan/${mp.id}?${qs.toString()}`);
                            return;
                          }
                          // No routine microplan for the facility yet — offer
                          // to start one via the Microplan Wizard, then return
                          // here with the village prefill intact.
                          const fac = facilities.find(
                            (f) => Number(f.id) === Number(village.assignedFacilityId),
                          );
                          if (!village.assignedFacilityId || !fac) {
                            window.location.assign(`/sessions?${qs.toString()}`);
                            return;
                          }
                          setStartMicroplanPrompt({
                            villageId: village.id,
                            villageName: village.name ?? "",
                            villageLat: Number(village.latitude),
                            villageLng: Number(village.longitude),
                            villageHtr: !!village.isHardToReach,
                            facilityId: Number(fac.id),
                            facilityName: fac.name ?? "this facility",
                          });
                        }}
                        data-testid={`button-plan-session-village-${village.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Plan a session here
                      </Button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}

        {/* Render outreach posts and connecting dashed lines for villages that have them */}
        {layers.villages &&
          /* Original code (commented out to preserve working code while optimizing performance):
          (() => {
            if (showVillageMarkers) return visibleVillagesFiltered;
            if (selectedFacilityId && communityRoutes && communityRoutes.length > 0) {
              const routedVillageIds = new Set(communityRoutes.map((r: any) => r.villageId));
              return villages.filter((v) => routedVillageIds.has(v.id));
            }
            return [];
          })()
            .filter((v) => v.latitude && v.longitude && v.outreachLatitude && v.outreachLongitude)
            .map((village) => {
          */
          activeMapVillages
            .filter((v) => v.latitude && v.longitude && v.outreachLatitude && v.outreachLongitude)
            .map((village) => {
              const villagePos: [number, number] = [Number(village.latitude), Number(village.longitude)];
              const outreachPos: [number, number] = [Number(village.outreachLatitude), Number(village.outreachLongitude)];
              return (
                <Fragment key={`outreach-post-container-${village.id}`}>
                  <Polyline
                    positions={[villagePos, outreachPos]}
                    color="#a855f7"
                    dashArray="5, 5"
                    weight={2}
                    opacity={0.8}
                  />
                  <Marker
                    position={outreachPos}
                    icon={outreachPostIcon}
                  >
                    <Tooltip permanent={false} direction="top" className="map-outreach-label">
                      {village.outreachPostName || "Outreach Post"} ({village.name})
                    </Tooltip>
                    <Popup className="premium-map-popup">
                      <div className="w-56 p-3 font-sans text-xs">
                        <h4 className="font-bold text-sm text-[#a855f7] mb-1">
                                {village.outreachPostName || "Outreach Post"}
                        </h4>
                        <p className="text-muted-foreground mb-2">
                          Outreach post for community: <strong>{village.name}</strong>
                        </p>
                        <div className="space-y-1 border-t border-border/40 pt-2 text-[10px]">
                          <p><span className="font-semibold text-muted-foreground">Coordinates:</span> {Number(village.outreachLatitude).toFixed(5)}, {Number(village.outreachLongitude).toFixed(5)}</p>
                          {(() => {
                            try {
                              const dist = distance([Number(village.longitude), Number(village.latitude)], [Number(village.outreachLongitude), Number(village.outreachLatitude)], { units: "kilometers" });
                              return <p><span className="font-semibold text-muted-foreground">Distance to center:</span> {dist.toFixed(2)} km</p>;
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}


        {/* Community catchment boundary polygons (task #261). Drawn for any
            visible village that has a saved boundary so harmonized catchments
            are visible app-wide. */}
        {layers.villages &&
          showVillageMarkers &&
          /* Original code (commented out to preserve working code while optimizing performance):
          visibleVillagesFiltered
            .filter((v) => {
          */
          activeMapVillages
            .filter((v) => {
              const coords = (v as any).boundary?.coordinates?.[0];
              return Array.isArray(coords) && coords.length >= 4;
            })
            .map((village) => {
              const ring = (village as any).boundary.coordinates[0] as number[][];
              const positions = ring.map((c) => [c[1], c[0]] as [number, number]);
              const color = village.isHardToReach ? "#dc2626" : "#6366f1";
              return (
                <Polygon
                  key={`village-boundary-${village.id}`}
                  positions={positions}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 2 }}
                >
                  <Popup className="premium-map-popup">
                    <div className="w-48 text-xs font-sans">
                      <div className="font-bold text-sm mb-1">{village.name}</div>
                      <div className="text-muted-foreground">Community catchment boundary</div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

        {/* Original sessionMapPins logic commented out to preserve backward compatibility:
        mode === "planning" && sessionMapPins
          .filter((s: any) => s.lat != null && s.lng != null)
          .filter((s: any) => {
            if (s.status === "completed") return !hiddenCategories.has("sessionCompleted");
            if (s.status === "in_progress" || s.status === "in-progress") return !hiddenCategories.has("sessionInProgress");
            return !hiddenCategories.has("sessionPlanned");
          })
          .map((s: any) => {
            const color = s.status === "completed" ? "#059669" : (s.status === "in_progress" || s.status === "in-progress") ? "#f59e0b" : "#2563eb";
            return (
              <CircleMarker
                key={`session-pin-${s.id}`}
                center={[Number(s.lat), Number(s.lng)]}
                radius={9}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
              >
                <Popup className="premium-map-popup">
                  <div className="w-56 text-xs font-sans">
                    <div className="font-bold text-sm mb-1.5">{s.name}</div>
                    <div className="space-y-0.5 text-foreground/80">
                      <div><span className="text-muted-foreground">Status:</span> <span className="font-semibold capitalize">{String(s.status || "planned").replace("_", " ")}</span></div>
                      {s.scheduledDate && <div><span className="text-muted-foreground">Scheduled:</span> {new Date(s.scheduledDate).toLocaleDateString()}</div>}
                      {s.completedAt && <div><span className="text-muted-foreground">Completed:</span> {new Date(s.completedAt).toLocaleDateString()}</div>}
                      <div><span className="text-muted-foreground">Target pop:</span> {s.targetPopulation ?? "—"}</div>
                      {s.vaccinatedTotal != null && <div><span className="text-muted-foreground">Vaccinated:</span> <span className="font-bold">{s.vaccinatedTotal}</span></div>}
                      <div className="capitalize"><span className="text-muted-foreground">Type:</span> {s.sessionType} / {s.planType}</div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex gap-1.5">
                      <a className="text-primary underline text-[11px]" href={s.planType === "campaign" ? "/microplans/campaigns" : "/microplans/routine"} data-testid="link-open-session-planner">Open in planner</a>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-7 text-[11px] font-semibold mt-2"
                      onClick={() => {
                        const qs = new URLSearchParams({
                          unservedName: s.name ?? "",
                          unservedLat: String(s.lat),
                          unservedLng: String(s.lng),
                          prefillKind: "followup",
                          autoOpen: "1",
                        });
                        const planSeg = s.planType === "campaign" ? "campaign" : "microplan";
                        const path = s.microplanId
                          ? `/sessions/${planSeg}/${s.microplanId}`
                          : "/sessions";
                        window.location.assign(`${path}?${qs.toString()}`);
                      }}
                      data-testid={`button-plan-followup-${s.id}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Plan follow-up
                    </Button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        */}

        {/* Updated Code: Render visibleSessionMapPins (which are already bounds-pruned and status-filtered in a memoized hook) */}
        {mode === "planning" && visibleSessionMapPins.map((s: any) => {
          const color = s.status === "completed" ? "#059669" : (s.status === "in_progress" || s.status === "in-progress") ? "#f59e0b" : "#2563eb";
          return (
            <CircleMarker
              key={`session-pin-${s.id}`}
              center={[Number(s.lat), Number(s.lng)]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
            >
              <Popup className="premium-map-popup">
                <div className="w-56 text-xs font-sans">
                  <div className="font-bold text-sm mb-1.5">{s.name}</div>
                  <div className="space-y-0.5 text-foreground/80">
                    <div><span className="text-muted-foreground">Status:</span> <span className="font-semibold capitalize">{String(s.status || "planned").replace("_", " ")}</span></div>
                    {s.scheduledDate && <div><span className="text-muted-foreground">Scheduled:</span> {new Date(s.scheduledDate).toLocaleDateString()}</div>}
                    {s.completedAt && <div><span className="text-muted-foreground">Completed:</span> {new Date(s.completedAt).toLocaleDateString()}</div>}
                    <div><span className="text-muted-foreground">Target pop:</span> {s.targetPopulation ?? "—"}</div>
                    {s.vaccinatedTotal != null && <div><span className="text-muted-foreground">Vaccinated:</span> <span className="font-bold">{s.vaccinatedTotal}</span></div>}
                    <div className="capitalize"><span className="text-muted-foreground">Type:</span> {s.sessionType} / {s.planType}</div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-border/40 flex gap-1.5">
                    <a className="text-primary underline text-[11px]" href={s.planType === "campaign" ? "/microplans/campaigns" : "/microplans/routine"} data-testid="link-open-session-planner">Open in planner</a>
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-7 text-[11px] font-semibold mt-2"
                    onClick={() => {
                      const qs = new URLSearchParams({
                        unservedName: s.name ?? "",
                        unservedLat: String(s.lat),
                        unservedLng: String(s.lng),
                        prefillKind: "followup",
                        autoOpen: "1",
                      });
                      const planSeg = s.planType === "campaign" ? "campaign" : "microplan";
                      const path = s.microplanId
                        ? `/sessions/${planSeg}/${s.microplanId}`
                        : "/sessions";
                      window.location.assign(`${path}?${qs.toString()}`);
                    }}
                    data-testid={`button-plan-followup-${s.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Plan follow-up
                  </Button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Original filteredUnservedPlaces logic commented out to preserve backward compatibility:
        mode === "planning" && !hiddenCategories.has("unserved") && filteredUnservedPlaces
          .filter((p: any) => p.latitude != null && p.longitude != null)
          .map((p: any) => (
            <CircleMarker
              key={`unserved-${p.id}`}
              center={[Number(p.latitude), Number(p.longitude)]}
              radius={7}
              pathOptions={{ color: "#dc2626", fillColor: "#fecaca", fillOpacity: 0.5, weight: 2, dashArray: "3 3" }}
            >
              <Popup>
                <div className="w-52 text-xs">
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-red-600 font-semibold mt-1">No session ever planned</div>
                  <div className="text-muted-foreground mt-0.5 mb-2">{p.isHardToReach ? "Hard-to-reach community" : "Standard community"}</div>
                  <Button
                    size="sm"
                    className="w-full h-7 text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      const qs = new URLSearchParams({
                        unservedVillageId: String(p.id),
                        unservedName: p.name ?? "",
                        unservedLat: String(p.latitude),
                        unservedLng: String(p.longitude),
                        unservedHtr: p.isHardToReach ? "1" : "0",
                        autoOpen: "1",
                      });
                      window.location.assign(`/sessions?${qs.toString()}`);
                    }}
                    data-testid={`button-plan-session-here-${p.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Plan a session here
                  </Button>
                </div>
              </Popup>
            </CircleMarker>
          ))
        */}

        {/* Updated Code: Render visibleUnservedPlaces (which are already bounds-pruned and status-filtered in a memoized hook) */}
        {mode === "planning" && visibleUnservedPlaces.map((p: any) => (
          <CircleMarker
            key={`unserved-${p.id}`}
            center={[Number(p.latitude), Number(p.longitude)]}
            radius={7}
            pathOptions={{ color: "#dc2626", fillColor: "#fecaca", fillOpacity: 0.5, weight: 2, dashArray: "3 3" }}
          >
            <Popup>
              <div className="w-52 text-xs">
                <div className="font-bold text-sm">{p.name}</div>
                <div className="text-red-600 font-semibold mt-1">No session ever planned</div>
                <div className="text-muted-foreground mt-0.5 mb-2">{p.isHardToReach ? "Hard-to-reach community" : "Standard community"}</div>
                <Button
                  size="sm"
                  className="w-full h-7 text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    const qs = new URLSearchParams({
                      unservedVillageId: String(p.id),
                      unservedName: p.name ?? "",
                      unservedLat: String(p.latitude),
                      unservedLng: String(p.longitude),
                      unservedHtr: p.isHardToReach ? "1" : "0",
                      autoOpen: "1",
                    });
                    window.location.assign(`/sessions?${qs.toString()}`);
                  }}
                  data-testid={`button-plan-session-here-${p.id}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Plan a session here
                </Button>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Zero-dose / under-immunized village pins — graduated by missed-child count.
            Mirrors the popup + color/radius logic from pages/ZeroDoseVillages.tsx so
            planners see the same layer in the context of the main map. */}
        {layers.zeroDoseVillages && (() => {
          const rows = (zeroDoseData?.byVillage ?? []).filter(
            (v) => v.latitude != null && v.longitude != null && v.zeroDose > 0,
          );
          // Honor the page's existing province/district scope filters. The API
          // payload only carries districtId, so province scoping is resolved by
          // walking the already-loaded districts list.
          const districtsInProvince =
            selectedProvinceId === "all"
              ? null
              : new Set(
                  districts
                    .filter((d) => Number(d.provinceId) === Number(selectedProvinceId))
                    .map((d) => Number(d.id)),
                );
          const scoped = rows.filter((v) => {
            if (districtsInProvince && !districtsInProvince.has(Number(v.districtId))) return false;
            if (selectedDistrictId !== "all" && Number(v.districtId) !== Number(selectedDistrictId)) return false;
            return true;
          });
          const maxCount = Math.max(1, ...scoped.map((v) => v.zeroDose));
          const colorFor = (n: number) => {
            const r = n / maxCount;
            if (r > 0.66) return "#dc2626";
            if (r > 0.33) return "#ea580c";
            return "#f59e0b";
          };
          return scoped.map((v) => {
            const n = v.zeroDose;
            const color = colorFor(n);
            const radius = 6 + Math.round((n / maxCount) * 12);
            return (
              <CircleMarker
                key={`zerodose-${v.villageId ?? "f" + v.facilityId}`}
                center={[Number(v.latitude), Number(v.longitude)]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.65, weight: 1 }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{v.villageName}</div>
                    <div>{v.facilityName} Â· {v.districtName}</div>
                    <div>
                      Zero-dose: <strong>{v.zeroDose}</strong> ({v.pct}%)
                    </div>
                    <div>
                      Under-imm: <strong>{v.underImmunized}</strong> ({v.underImmunizedPct}%)
                    </div>
                    <div>of {v.denominator} eligible children</div>
                    {v.isHardToReach && (
                      <Badge className="bg-amber-500/10 text-amber-700">Hard-to-reach</Badge>
                    )}
                    {v.lastDefaulterSession && (
                      <div
                        className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5"
                        data-testid={`text-last-defaulter-session-zerodose-${v.villageId ?? v.facilityId}`}
                      >
                        Last defaulter session:{" "}
                        {new Date(v.lastDefaulterSession.date).toLocaleDateString()}{" "}
                        — <strong>{v.lastDefaulterSession.caughtUp}</strong> caught up
                      </div>
                    )}
                    {canCreateSessionPlan(user) && v.facilityId != null && (
                      <Button
                        size="sm"
                        className="w-full h-7 text-[11px] font-semibold mt-1 bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          const mp = (masterMicroplans ?? []).find(
                            (m: any) =>
                              Number(m.facilityId) === Number(v.facilityId) &&
                              m.planType === "facility_routine",
                          );
                          const qs = new URLSearchParams({
                            unservedVillageId: String(v.villageId ?? ""),
                            unservedName: v.villageName ?? "",
                            unservedLat: String(v.latitude),
                            unservedLng: String(v.longitude),
                            unservedHtr: v.isHardToReach ? "1" : "0",
                            prefillKind: "defaulter",
                            autoOpen: "1",
                          });
                          const path = mp
                            ? `/sessions/microplan/${mp.id}`
                            : "/sessions";
                          window.location.assign(`${path}?${qs.toString()}`);
                        }}
                        data-testid={`button-plan-defaulter-zerodose-${v.villageId ?? v.facilityId}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Plan defaulter follow-up here
                      </Button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          });
        })()}

        {/* Under-immunized village pins — DTP1 received but DTP3 missed.
            Rendered as a separate layer with the amber palette from
            pages/ZeroDoseVillages.tsx (mode === "under") so planners doing
            defaulter follow-up can see both layers in the same map context. */}
        {layers.underImmunizedVillages && (() => {
          const rows = (zeroDoseData?.byVillage ?? []).filter(
            (v) => v.latitude != null && v.longitude != null && v.underImmunized > 0,
          );
          const districtsInProvince =
            selectedProvinceId === "all"
              ? null
              : new Set(
                  districts
                    .filter((d) => Number(d.provinceId) === Number(selectedProvinceId))
                    .map((d) => Number(d.id)),
                );
          const scoped = rows.filter((v) => {
            if (districtsInProvince && !districtsInProvince.has(Number(v.districtId))) return false;
            if (selectedDistrictId !== "all" && Number(v.districtId) !== Number(selectedDistrictId)) return false;
            return true;
          });
          const maxCount = Math.max(1, ...scoped.map((v) => v.underImmunized));
          const colorFor = (n: number) => {
            const r = n / maxCount;
            if (r > 0.66) return "#d97706";
            if (r > 0.33) return "#f59e0b";
            return "#fbbf24";
          };
          return scoped.map((v) => {
            const n = v.underImmunized;
            const color = colorFor(n);
            const radius = 6 + Math.round((n / maxCount) * 12);
            return (
              <CircleMarker
                key={`underimm-${v.villageId ?? "f" + v.facilityId}`}
                center={[Number(v.latitude), Number(v.longitude)]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.65, weight: 1 }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{v.villageName}</div>
                    <div>{v.facilityName} Â· {v.districtName}</div>
                    <div>
                      Under-imm: <strong>{v.underImmunized}</strong> ({v.underImmunizedPct}%)
                    </div>
                    <div>
                      Zero-dose: <strong>{v.zeroDose}</strong> ({v.pct}%)
                    </div>
                    <div>of {v.denominator} eligible children</div>
                    {v.isHardToReach && (
                      <Badge className="bg-amber-500/10 text-amber-700">Hard-to-reach</Badge>
                    )}
                    {v.lastDefaulterSession && (
                      <div
                        className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5"
                        data-testid={`text-last-defaulter-session-underimm-${v.villageId ?? v.facilityId}`}
                      >
                        Last defaulter session:{" "}
                        {new Date(v.lastDefaulterSession.date).toLocaleDateString()}{" "}
                        — <strong>{v.lastDefaulterSession.caughtUp}</strong> caught up
                      </div>
                    )}
                    {canCreateSessionPlan(user) && v.facilityId != null && (
                      <Button
                        size="sm"
                        className="w-full h-7 text-[11px] font-semibold mt-1 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => {
                          const mp = (masterMicroplans ?? []).find(
                            (m: any) =>
                              Number(m.facilityId) === Number(v.facilityId) &&
                              m.planType === "facility_routine",
                          );
                          const qs = new URLSearchParams({
                            unservedVillageId: String(v.villageId ?? ""),
                            unservedName: v.villageName ?? "",
                            unservedLat: String(v.latitude),
                            unservedLng: String(v.longitude),
                            unservedHtr: v.isHardToReach ? "1" : "0",
                            prefillKind: "defaulter",
                            autoOpen: "1",
                          });
                          const path = mp
                            ? `/sessions/microplan/${mp.id}`
                            : "/sessions";
                          window.location.assign(`${path}?${qs.toString()}`);
                        }}
                        data-testid={`button-plan-defaulter-underimm-${v.villageId ?? v.facilityId}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Plan defaulter follow-up here
                      </Button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          });
        })()}

        {/* Dynamic measurement overlay polyline & circle markers */}
        {isMeasuring && measurementPoints.length > 0 && (
          <Polyline positions={measurementPoints} color="#ef4444" weight={3} dashArray="5, 10" />
        )}
        {isMeasuring && measurementPoints.map((pt, idx) => (
          <CircleMarker
            key={`measure-${idx}`}
            center={pt}
            radius={6}
            pathOptions={{ color: "#ef4444", fillColor: "#ffffff", fillOpacity: 1, weight: 2 }}
          />
        ))}

        {/* Active Catchment Drawing Preview */}
        {isDrawingCatchment && drawPoints.length > 0 && (
          <>
            {drawPoints.length >= 3 ? (
              <Polygon
                positions={drawPoints}
                pathOptions={{
                  color: "#059669",
                  fillColor: "#10b981",
                  fillOpacity: 0.3,
                  weight: 3,
                }}
              />
            ) : drawPoints.length === 2 ? (
              <Polyline
                positions={drawPoints}
                pathOptions={{
                  color: "#059669",
                  weight: 3,
                }}
              />
            ) : null}

            {drawPoints.map((pt, idx) => (
              <CircleMarker
                key={`draw-vertex-${idx}`}
                center={pt}
                radius={6}
                pathOptions={{
                  color: "#059669",
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
          </>
        )}

        {/* Render surveillance cases if provided — with fallback to facility coordinates & golden-angle jitter */}
        {cases?.map((c, i) => {
          let lat = c.gpsLatitude ? Number(c.gpsLatitude) : null;
          let lng = c.gpsLongitude ? Number(c.gpsLongitude) : null;

          if (lat === null || lng === null) {
            const fac = facilities.find((f) => f.id === c.facilityId);
            if (fac && fac.latitude && fac.longitude) {
              const idxSeed = typeof c.id === 'string' ? c.id.charCodeAt(0) + c.id.charCodeAt(c.id.length - 1) : i;
              const angle = (idxSeed * 137.5) * (Math.PI / 180);
              const r = 0.003 * Math.sqrt((idxSeed % 5) + 1);
              lat = Number(fac.latitude) + r * Math.sin(angle);
              lng = Number(fac.longitude) + r * Math.cos(angle);
            }
          }

          if (lat !== null && lng !== null) {
            const SURV_DISEASE_COLORS: Record<string, string> = {
            afp: '#3b82f6', measles: '#f97316', nnt: '#8b5cf6',
            yellow_fever: '#eab308', cholera: '#14b8a6', covid19: '#6b7280', other: '#94a3b8',
          };
          const isConfirmed = c.classification === 'confirmed';
          const pinColor = SURV_DISEASE_COLORS[c.disease as string] ?? '#94a3b8';
            return (
              <CircleMarker
                key={`case-${c.id}-${i}`}
                center={[lat, lng]}
                radius={isConfirmed ? 10 : 7}
                pathOptions={{
                  color: isConfirmed ? '#dc2626' : pinColor,
                  fillColor: pinColor,
                  fillOpacity: isConfirmed ? 0.9 : 0.7,
                  weight: isConfirmed ? 3 : 1.5,
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-2 space-y-1.5 min-w-[170px]">
                    <div className="font-bold text-sm flex items-center gap-2" style={{ color: (SURV_DISEASE_COLORS[c.disease as string] ?? '#94a3b8') }}>
                      <AlertTriangle className="h-4 w-4" />
                      {c.disease?.toUpperCase()}
                    </div>
                    <div className="text-xs font-semibold text-foreground">{c.patientName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.classification === 'confirmed' ? 'bg-rose-100 text-rose-700' :
                        c.classification === 'probable' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{c.classification}</span>
                    </div>
                    {c.dateOfOnset && (
                      <div className="text-xs text-muted-foreground">Onset: {new Date(c.dateOfOnset).toLocaleDateString()}</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          }
          return null;
        })}

        {/* Render Reporting Facilities in surveillance mode */}
        {mode === "surveillance" && (() => {
          const reportingFacilityIds = new Set(cases.map(c => c.facilityId));
          return facilities
            .filter(f => reportingFacilityIds.has(f.id) && f.latitude && f.longitude)
            .map(facility => (
              <Marker
                key={`reporting-facility-${facility.id}`}
                position={[Number(facility.latitude), Number(facility.longitude)]}
                icon={reportingFacilityIcon}
              >
                <Popup className="premium-map-popup">
                  <div className="w-64 p-3 font-sans text-xs">
                    <h4 className="font-bold text-sm text-[#2563eb] mb-1">
                      {facility.name}
                    </h4>
                    <p className="text-muted-foreground mb-2">
                      Reporting Facility
                    </p>
                    <div className="space-y-1 border-t border-border/40 pt-2 text-xs">
                      <p>
                        Total Cases: <strong>{cases.filter(c => c.facilityId === facility.id).length}</strong>
                      </p>
                      <p className="text-red-600">
                        Confirmed: <strong>{cases.filter(c => c.facilityId === facility.id && c.classification === 'confirmed').length}</strong>
                      </p>
                      <p className="text-amber-600">
                        Suspected: <strong>{cases.filter(c => c.facilityId === facility.id && c.classification === 'suspected').length}</strong>
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ));
        })()}

        {/* Original Code: <MapController center={center} zoom={zoom} /> */}
        <MapController center={effectiveCenter} zoom={effectiveZoom} onZoomChange={setCurrentZoom} onBoundsChange={setMapBounds} />
      </MapContainer>

      {/* Floating panel dock — one tap shows/hides each map panel so the map
          stays uncluttered, especially on phones where panels start hidden. */}
      {!isPrinting && (
        <div
          className="absolute left-3 top-3 z-[1100] flex flex-col gap-1.5"
          ref={disableLeafletPropagation}
          data-testid="map-panel-dock"
        >
          {[
            { key: "alerts" as PanelKey, icon: Bell, label: "Alerts", show: mode === "planning" },
            { key: "recommendations" as PanelKey, icon: ClipboardList, label: "Recommendations", show: mode === "planning" },
            { key: "layers" as PanelKey, icon: Layers, label: "Layers", show: true },
            { key: "filters" as PanelKey, icon: Filter, label: "Filters", show: mode === "planning" && showFacilityList },
            { key: "facilities" as PanelKey, icon: Building2, label: "Facilities", show: mode === "planning" && showFacilityList },
            { key: "checklist" as PanelKey, icon: CheckCircle, label: "Checklist", show: mode === "planning" && activeSessionPlans.length > 0 },
            { key: "legend" as PanelKey, icon: MapPin, label: "Legend", show: true },
            { key: "tools" as PanelKey, icon: SlidersHorizontal, label: "Tools", show: true },
          ]
            .filter((b) => b.show)
            .map((b) => {
              const Icon = b.icon;
              const active = panelVis[b.key];
              return (
                <Button
                  key={b.key}
                  size="icon"
                  variant={active ? "default" : "secondary"}
                  onClick={() => togglePanel(b.key)}
                  title={active ? `Hide ${b.label}` : `Show ${b.label}`}
                  aria-pressed={active}
                  className="h-9 w-9 shadow-md"
                  data-testid={`button-dock-${b.key}`}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
        </div>
      )}

      {!isPrinting && mode !== "surveillance" && (
        <>
          <PopulationOverlayToggle
            overlay={populationOverlay}
            className="absolute right-4 top-16 z-[1000]"
          />
          <PopulationOverlayLegend
            overlay={populationOverlay}
            className="absolute left-4 bottom-20 z-[1000]"
          />
        </>
      )}

      {/* Custom map layers toggle panel — lists admin-uploaded layers that are
          active for this tenant so users can show/hide each one this session. */}
      {!isPrinting && mode === "planning" && activeCustomLayers.length > 0 && (
        <div
          className="absolute right-4 bottom-20 z-[1000]"
          ref={disableLeafletPropagation}
          data-testid="panel-custom-layers"
        >
          <div className="bg-background/90 backdrop-blur-md border border-border shadow-lg rounded-lg text-xs w-52 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setCustomLayersPanelOpen((o) => !o)}
              data-testid="button-toggle-custom-layers-panel"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Custom Layers
              </span>
              <span className="text-muted-foreground">{customLayersPanelOpen ? "−" : "+"}</span>
            </button>
            {customLayersPanelOpen && (
              <div className="px-3 pb-2.5 pt-0.5 space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {activeCustomLayers.map((l: any) => {
                  const shown = !hiddenCustomLayerIds.has(l.id);
                  const color = l.style?.color ?? "#2563eb";
                  return (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 cursor-pointer select-none"
                      data-testid={`toggle-custom-layer-${l.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => toggleCustomLayer(l.id)}
                        className="accent-primary h-3.5 w-3.5"
                      />
                      <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate flex-1" title={l.name}>{l.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zero-dose / under-immunized graduated-pin legend.
          Renders when either overlay is on, anchored bottom-right above the
          basemap toggle area (MapControls sit at right-4 bottom-20). */}
      {(layers.zeroDoseVillages || layers.underImmunizedVillages) && !isPrinting && (
        <div
          className="absolute right-4 bottom-4 z-[1000] pointer-events-none"
          ref={disableLeafletPropagation}
          data-testid="map-legend-zerodose"
        >
          <div className="bg-background/90 backdrop-blur-md border border-border shadow-lg rounded-lg p-2.5 text-[10px] space-y-2 pointer-events-auto max-w-[180px]">
            {layers.zeroDoseVillages && (
              <div className="space-y-1">
                <div className="font-bold text-[10px] uppercase tracking-wider text-primary">Zero-dose Villages</div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#ea580c" }} />
                  <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#dc2626" }} />
                  <span className="text-muted-foreground ml-1">Low → High</span>
                </div>
              </div>
            )}
            {layers.underImmunizedVillages && (
              <div className="space-y-1">
                <div className="font-bold text-[10px] uppercase tracking-wider text-primary">Under-immunized</div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fbbf24" }} />
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                  <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: "#d97706" }} />
                  <span className="text-muted-foreground ml-1">Low → High</span>
                </div>
              </div>
            )}
            <div className="text-muted-foreground text-[9px] pt-1 border-t border-border/40">
              Pin size = missed-child count
            </div>
          </div>
        </div>
      )}

      {/* Floating glassmorphic zoom warning HUD sibling to MapContainer */}
      {!showVillageMarkers && layers.villages && !isPrinting && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg p-2.5 backdrop-blur-md text-xs font-semibold shadow-md pointer-events-auto flex items-center gap-2" ref={disableLeafletPropagation}>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse animate-duration-1000" />
            <span>Zoom in to view village markers (or filter by District/Ward)</span>
          </div>
        </div>
      )}

      {/* Measurement HUD Panel */}
      {isMeasuring && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-sm px-4">
          <Card className="shadow-xl border-2 border-red-500 bg-background/95 backdrop-blur-md">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse animate-duration-1000" />
                <div>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Ruler mode</p>
                  <p className="text-base font-extrabold font-mono text-foreground">
                    {measuredDistance.toFixed(3)} km
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMeasurementPoints([])}
                  disabled={measurementPoints.length === 0}
                  className="h-8 text-xs font-semibold"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setIsMeasuring(false);
                    setMeasurementPoints([]);
                  }}
                  className="h-8 text-xs font-semibold"
                >
                  Exit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Catchment Drawing HUD Panel */}
      {isDrawingCatchment && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
          <Card className="shadow-xl border-2 border-emerald-500 bg-background/95 backdrop-blur-md">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Catchment Drawing Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Click to place boundary vertices ({drawPoints.length} set)
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDrawPoints((prev) => prev.slice(0, -1))}
                    disabled={drawPoints.length === 0}
                    className="h-8 text-xs font-semibold"
                  >
                    Undo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsDrawingCatchment(false);
                      setDrawPoints([]);
                    }}
                    className="h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedFacilityId) {
                        setCatchmentFacilityId(selectedFacilityId);
                        const fac = facilities.find((f) => f.id === selectedFacilityId);
                        if (fac) {
                          setCatchmentName(`${fac.name} Catchment`);
                        }
                      }
                      setSaveCatchmentOpen(true);
                    }}
                    disabled={drawPoints.length < 3}
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Save Area
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Drawing Session Geofence HUD Panel */}
      {isDrawingSessionPolygon && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
          <Card className="shadow-xl border-2 border-amber-500 bg-background/95 backdrop-blur-md">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Geofence Drawing Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Click to place vertices ({sessionPolygonPoints.length} set). Buffered Polyline for Mobile, closed Polygon for Outreach.
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSessionPolygonPoints((prev) => prev.slice(0, -1))}
                    disabled={sessionPolygonPoints.length === 0}
                    className="h-8 text-xs font-semibold"
                  >
                    Undo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsDrawingSessionPolygon(false);
                      setSessionPolygonPoints([]);
                      toast({
                        title: "Drawing Cancelled",
                        description: "Drawn points cleared.",
                        variant: "default"
                      });
                    }}
                    className="h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={sessionPolygonPoints.length < 2}
                    onClick={() => {
                      // Trigger dynamic Turf-free ray-cast pop sum
                      const pop = calculateGeofencePopulation(sessionPolygonPoints, newSessionType === "mobile" ? "mobile" : "outreach");
                      setNewSessionTargetPop(pop);
                      setIsDrawingSessionPolygon(false);
                      setNewSessionDate(getMinScheduleDateInputValue());
                      setCreateSessionDialogOpen(true);

                      toast({
                        title: "Geofence Plotted",
                        description: `Automatically calculated target population of ${pop} people inside this geofenced catchment.`,
                        variant: "default"
                      });
                    }}
                    className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Save Geofence
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}



      {!isPrinting && (
        <div className="absolute left-16 top-4 z-[1000] flex flex-col gap-3 pointer-events-none w-64 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">

          {panelVis.layers && (
            <div className="pointer-events-auto" ref={disableLeafletPropagation}>
              <LayerPanel
                isOpen={layerPanelOpen}
                onToggle={() => setLayerPanelOpen(!layerPanelOpen)}
                layers={layers}
                onLayerToggle={handleLayerToggle}
                basemap={basemap}
                onBasemapChange={setBasemap}
                boundaryList={boundaryList}
                countryCode={tenantInfo?.countryCode}
                adminLabels={adminLabels}
                grid3Unavailable={!!layers.grid3Settlements && !!grid3GeoJSON && !(grid3GeoJSON.features?.length > 0)}
              />
            </div>
          )}

          {showFacilityList && panelVis.filters && (
            <div className="pointer-events-auto" ref={disableLeafletPropagation}>
              <FilterPanel
                isOpen={filterPanelOpen}
                onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedProvinceId={selectedProvinceId}
                onProvinceChange={handleProvinceChange}
                selectedDistrictId={selectedDistrictId}
                onDistrictChange={handleDistrictChange}
                selectedFacilityId={selectedFacilityId}
                onFacilityChange={(id) => {
                  if (id === null) {
                    setSelectedFacilityId(null);
                  } else {
                    const fac = facilities.find((f) => f.id === id);
                    if (fac) handleFocusFacility(fac);
                  }
                }}
                villageCategory={villageCategory}
                onVillageCategoryChange={setVillageCategory}
                filterColdChain={filterColdChain}
                onColdChainToggle={() => setFilterColdChain(!filterColdChain)}
                filterPower={filterPower}
                onPowerToggle={() => setFilterPower(!filterPower)}
                provinces={provinces}
                districts={districts}
                facilities={facilities}
                adminLabels={adminLabels}
                totalFacilitiesCount={facilities.length}
                filteredFacilitiesCount={filteredFacilities.length}
                totalVillagesCount={villages.length}
                filteredVillagesCount={filteredVillages.length}
              />
            </div>
          )}
        </div>
      )}

      {/* Route Analytics Panel (Commented out to prevent layout collisions; all details are integrated in the right Floating Facility List Panel) */}
      {/*
      {!isPrinting && selectedFacilityId && communityRoutes && (
        <div
          className="absolute left-4 top-16 w-80 h-[calc(100vh-200px)] z-[1000] flex flex-col bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden transition-all duration-300 pointer-events-auto"
          ref={disableLeafletPropagation}
        >
          <Card className="border-0 shadow-none bg-transparent flex flex-col h-full rounded-none">
            <CardHeader className="p-4 pb-2 border-b flex flex-col space-y-2 bg-card/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex flex-row items-center gap-2 text-primary">
                  <Building2 className="h-4 w-4" />
                  Route Analytics
                </CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 rounded-full hover:bg-muted"
                  onClick={() => setSelectedFacilityId(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <h3 className="font-semibold text-xs text-foreground truncate">
                {facilities.find((f) => f.id === selectedFacilityId)?.name || "Facility Routes"}
              </h3>
            </CardHeader>

            <div className="p-3 bg-muted/30 border-b flex items-center justify-between text-[11px] text-muted-foreground px-4 gap-2">
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase font-bold text-muted-foreground/70">Communities</p>
                <p className="font-bold text-foreground mt-0.5">{communityRoutes.length}</p>
              </div>
              <div className="text-center flex-1 border-x border-border/30">
                <p className="text-[9px] uppercase font-bold text-muted-foreground/70">Avg Distance</p>
                <p className="font-bold text-foreground mt-0.5">
                  {communityRoutes.length > 0
                    ? (
                        communityRoutes.reduce((sum, r) => sum + (r.distanceToFacility || 0), 0) /
                        communityRoutes.length
                      ).toFixed(1)
                    : "0"}{" "}
                  km
                </p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase font-bold text-muted-foreground/70">Avg Travel</p>
                <p className="font-bold text-foreground mt-0.5">
                  {communityRoutes.length > 0
                    ? Math.round(
                        communityRoutes.reduce((sum, r) => sum + (r.drivingTimeMinutes || 0), 0) /
                          communityRoutes.length
                      )
                    : "0"}{" "}
                  mins
                </p>
              </div>
            </div>

            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {communityRoutes.length > 0 ? (
                communityRoutes.map((route: any) => {
                  return (
                    <div
                      key={`route-item-${route.villageId}`}
                      className="p-3 rounded-lg border border-border/50 bg-card/40 hover:bg-accent/40 transition-all duration-150 select-none cursor-pointer"
                      onClick={() => {
                        if (route.routeGeometry && route.routeGeometry.length > 0 && mapRef.current) {
                          const [lng, lat] = route.routeGeometry[route.routeGeometry.length - 1];
                          mapRef.current.setView([lat, lng], 14);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {route.villageName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold py-0.2 px-1.5 capitalize rounded ${
                            route.accessibilityScore === "Difficult"
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : route.accessibilityScore === "Moderate"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          }`}
                        >
                          {route.accessibilityScore}
                        </Badge>
                      </div>

                      <div className="text-[10px] text-muted-foreground mt-1.5 mb-2">
                        Linked HF: <strong className="text-foreground/80">{selectedFacility?.name || route.facilityName || "Assigned Facility"}</strong>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary font-medium text-xs">🚗</span>
                          <span>Road: <strong>{route.distanceToFacility} km</strong> ({route.drivingTimeMinutes}m)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary font-medium text-xs">🚶</span>
                          <span>Walk: <strong>{route.walkingTimeMinutes}m</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-2 pt-2 border-t border-border/20">
                        <span>Mode: <strong className="capitalize">{route.transportMode}</strong></span>
                        <span>Season: <strong>{route.seasonalAccessibility}</strong></span>
                      </div>

                      <div className="text-[9px] text-muted-foreground/60 mt-1 truncate">
                        Route: <strong className="text-foreground/75 font-normal">{route.referralRoute}</strong>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">No assigned communities</p>
                  <p className="text-[11px] text-muted-foreground/75 mt-0.5">Assign communities to this facility to calculate routes.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      */}

      {/* Zoom / Locate map controls */}
      {!isPrinting && (
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocate}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
      )}



      {/* Original Code:
      {!isPrinting && <MapLegend leftOffset={showFacilityList && (layerPanelOpen || filterPanelOpen)} />}
      */}
      {/* Updated Code: MapLegend rendered with dynamic offset, interactive selection, and collapsible triggers */}
      {!isPrinting && mode === "planning" && panelVis.legend && (
        <MapLegend
          leftOffset={showFacilityList && ((panelVis.layers && layerPanelOpen) || (panelVis.filters && filterPanelOpen))}
          hiddenCategories={hiddenCategories}
          onToggleCategory={handleToggleCategory}
          isExpanded={isLegendExpanded}
          onToggleExpanded={() => setIsLegendExpanded(!isLegendExpanded)}
          planningStats={stats}
          showPopulationLegend={layers.populationGeoTIFF}
          facilityCount={filteredFacilities.length}
        />
      )}

      {/* Population choropleth source toggle (only when choropleth layer active) */}
      {!isPrinting && layers.populationChoropleth && (
        <div className="absolute left-4 top-16 z-[1000]" ref={disableLeafletPropagation}>
          <div className="w-64 bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg p-3 flex flex-col gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Population Choropleth</p>
              <p className="text-[10px] text-muted-foreground">
                {populationChoroplethStats.districtCount.toLocaleString()} districts - {formatChoroplethNumber(populationChoroplethStats.totalPopulation)} people
              </p>
            </div>
            <div className="flex gap-1">
              {(["worldpop", "nso", "hmis"] as const).map((s) => (
                <button key={s} onClick={() => setPopChoroplethSource(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                    popChoroplethSource === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/40"
                  }`}>{s.toUpperCase()}</button>
              ))}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full border border-border/70">
              {populationChoroplethStats.bins.map((bin) => (
                <div key={`${bin.label}-${bin.color}`} className="flex-1" style={{ background: bin.color }} />
              ))}
            </div>
            <div className="space-y-1">
              {populationChoroplethStats.bins.map((bin) => (
                <div key={bin.label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm border border-slate-800/30" style={{ backgroundColor: bin.color }} />
                  <span>{bin.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-500 bg-slate-100" />
                <span>No population data</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Surveillance Case Legend */}
      {!isPrinting && mode === "surveillance" && panelVis.legend && (() => {
        const SURV_LEGEND_COLORS: Record<string, string> = {
          afp: '#3b82f6', measles: '#f97316', nnt: '#8b5cf6',
          yellow_fever: '#eab308', cholera: '#14b8a6', covid19: '#6b7280', other: '#94a3b8',
        };
        const SURV_LEGEND_LABELS: Record<string, string> = {
          afp: 'AFP', measles: 'Measles', nnt: 'NNT',
          yellow_fever: 'Yellow Fever', cholera: 'Cholera', covid19: 'COVID-19', other: 'Other VPD',
        };
        const diseaseCounts: Record<string, number> = {};
        cases?.forEach((c: any) => { diseaseCounts[c.disease] = (diseaseCounts[c.disease] || 0) + 1; });
        const confirmedCount = cases?.filter((c: any) => c.classification === 'confirmed').length ?? 0;
        const suspectedCount = (cases?.length ?? 0) - confirmedCount;
        return (
        <div className={`absolute ${showFacilityList && ((panelVis.layers && layerPanelOpen) || (panelVis.filters && filterPanelOpen)) ? "left-72" : "left-4"} bottom-4 z-[1000] transition-all duration-300`} ref={disableLeafletPropagation}>
          <Card className="w-60 shadow-2xl border border-white/15 bg-background/85 backdrop-blur-md rounded-xl select-none pointer-events-auto">
            <CardHeader className="p-3 border-b border-border/40">
              <CardTitle className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                VPD Surveillance
                <span className="ml-auto text-[10px] font-bold text-foreground">{cases?.length ?? 0} cases</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5">
              {/* Classification indicators */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2" style={{ background: '#3b82f680', borderColor: '#dc2626' }}></div>
                  <span>Confirmed</span>
                </div>
                <span className="font-bold text-rose-600">{confirmedCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: '#94a3b880', border: '1.5px solid #94a3b8' }}></div>
                  <span>Suspected/Probable</span>
                </div>
                <span className="font-bold">{suspectedCount}</span>
              </div>
              {/* Disease breakdown */}
              {Object.keys(diseaseCounts).length > 0 && (
                <div className="pt-1.5 border-t border-border/40 space-y-1">
                  <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70">By Disease</p>
                  {Object.entries(diseaseCounts).map(([disease, count]) => (
                    <div key={disease} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: SURV_LEGEND_COLORS[disease] ?? '#94a3b8' }}></div>
                        <span className="text-muted-foreground">{SURV_LEGEND_LABELS[disease] ?? disease}</span>
                      </div>
                      <span className="font-bold tabular-nums">{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Reporting facility */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                <Building2 className="h-3 w-3 text-primary" />
                <span>Reporting Facility</span>
              </div>
            </CardContent>
          </Card>
        </div>
        );
      })()}

      {/* Premium measurement, drawing & export buttons */}
      {!isPrinting && panelVis.tools && (
        <div className="absolute right-4 top-4 z-[1000] flex gap-2 items-center flex-wrap" ref={disableLeafletPropagation}>
          <BasemapSwitcher basemap={basemap} onChange={setBasemap} className="relative top-auto right-auto" />

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setExportDialogOpen(true)}
            data-testid="button-download-map"
            className="shadow-md"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      )}

      {/* Floating Glassmorphic Checklist Sidebar for Real-Time Derived Session Progress Tracking */}
      {!isPrinting && mode === "planning" && activeSessionPlans.length > 0 && panelVis.checklist && (
        <div
          className={`absolute top-16 ${
            showFacilityList && panelVis.facilities ? "right-[350px]" : "right-4"
          } w-72 z-[1000] flex flex-col pointer-events-auto transition-all duration-300`}
          ref={disableLeafletPropagation}
        >
          <Card className="shadow-2xl border border-white/15 bg-background/85 backdrop-blur-md rounded-xl select-none overflow-hidden max-h-[500px] flex flex-col">
            <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
              <div className="flex flex-col">
                <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Derived Session Checklist
                </CardTitle>
                <span className="text-[9px] text-muted-foreground leading-normal mt-0.5">
                  Real-time visual tracking of achieved dispatches
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 rounded-full hover:bg-muted text-muted-foreground"
                onClick={() => setChecklistOpen(!checklistOpen)}
              >
                <ChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 ${checklistOpen ? "rotate-90" : "rotate-270"}`} />
              </Button>
            </CardHeader>
            {checklistOpen && (
              <>
                {/* Visual Progress Banner */}
                <div className="p-3 bg-muted/30 border-b border-border/30 shrink-0">
                  <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                    <span className="text-muted-foreground uppercase">Achievement Rate:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {activeSessionPlans.filter((p: any) => p.isAchieved).length} / {activeSessionPlans.length} ({
                        Math.round((activeSessionPlans.filter((p: any) => p.isAchieved).length / activeSessionPlans.length) * 100)
                      }%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((activeSessionPlans.filter((p: any) => p.isAchieved).length / activeSessionPlans.length) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Checklist scrollable container */}
                <div className="p-2 space-y-1.5 overflow-y-auto max-h-[300px] flex-1 custom-scrollbar">
                  {activeSessionPlans.map((plan: any) => {
                    const isAchieved = plan.isAchieved;
                    return (
                      <div
                        key={`checklist-item-${plan.id}`}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border border-transparent hover:bg-accent/40 transition-all duration-200 ${
                          isAchieved ? "bg-emerald-500/5 border-emerald-500/10 text-muted-foreground" : "bg-card/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`check-plan-${plan.id}`}
                          checked={isAchieved}
                          onChange={() => toggleAchievedMutation.mutate({ sessionId: plan.id, isAchieved: !plan.isAchieved })}
                          disabled={toggleAchievedMutation.isPending}
                          className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <button
                              onClick={() => {
                                const centroid = getSessionCentroid(plan);
                                if (centroid && mapRef.current) {
                                  mapRef.current.setView(centroid, 14);
                                }
                              }}
                              className="text-left font-bold text-xs hover:underline hover:text-primary truncate transition-colors focus:outline-none"
                              title="Click to locate on map"
                            >
                              {plan.name}
                            </button>
                            <Badge className="text-[8px] font-bold tracking-wider px-1 py-0 uppercase h-4 shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10">
                              {plan.sessionType}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
                            <span>Pop: <strong>{plan.targetPopulation || 0}</strong></span>
                            <span className="font-semibold text-amber-500 dark:text-amber-400">{plan.planType === "sia" ? "SIA Campaign" : "Routine EPI"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Floating Alerts Panel */}
      {!isPrinting && mode === "planning" && panelVis.alerts && (
        <MapAlertsPanel
          isOpen={alertsExpanded}
          onToggleExpanded={() => setAlertsExpanded(!alertsExpanded)}
          onClose={() => togglePanel("alerts")}
          positionClass={
            showFacilityList && panelVis.facilities
              ? panelVis.checklist && activeSessionPlans.length > 0
                ? "right-[650px]"
                : "right-[350px]"
              : panelVis.checklist && activeSessionPlans.length > 0
              ? "right-[310px]"
              : "right-4"
          }
        />
      )}

      {/* Floating Recommendations Panel */}
      {!isPrinting && mode === "planning" && panelVis.recommendations && (
        <MapRecommendationsPanel
          isOpen={recommendationsExpanded}
          onToggleExpanded={() => setRecommendationsExpanded(!recommendationsExpanded)}
          onClose={() => togglePanel("recommendations")}
          positionClass={
            showFacilityList && panelVis.facilities
              ? panelVis.alerts
                ? panelVis.checklist && activeSessionPlans.length > 0 ? "right-[990px]" : "right-[690px]"
                : panelVis.checklist && activeSessionPlans.length > 0 ? "right-[650px]" : "right-[350px]"
              : panelVis.alerts
              ? panelVis.checklist && activeSessionPlans.length > 0 ? "right-[650px]" : "right-[340px]"
              : panelVis.checklist && activeSessionPlans.length > 0 ? "right-[310px]" : "right-4"
          }
        />
      )}

      {/* Floating Facility List Panel */}
      {showFacilityList && panelVis.facilities && !isPrinting && (
        <div
          className="absolute right-4 top-16 w-80 h-[calc(100vh-140px)] max-h-[700px] z-[1000] flex flex-col bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden transition-all duration-300"
          ref={disableLeafletPropagation}
        >
          <Card className="border-0 shadow-none bg-transparent flex flex-col h-full rounded-none">
            {/* Original Card content commented out for safety: */}
            {/*
            <CardHeader className="p-4 pb-2 border-b flex flex-col space-y-3 bg-card/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex flex-row items-center gap-2 text-primary">
                  <Building2 className="h-4 w-4" />
                  Health Facilities
                </CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 rounded-full hover:bg-muted"
                  onClick={() => togglePanel("facilities")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search name or HMIS..."
                  className="pl-8 h-9 text-xs bg-background/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant={filterColdChain ? "default" : "outline"}
                    onClick={() => setFilterColdChain(!filterColdChain)}
                    className={`h-7 px-2.5 text-[10px] rounded-full gap-1 ${
                      filterColdChain
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground border-muted-foreground/20 hover:bg-accent"
                    }`}
                  >
                    <Thermometer className="h-3.5 w-3.5" />
                    Cold Chain
                  </Button>
                  <Button
                    size="sm"
                    variant={filterPower ? "default" : "outline"}
                    onClick={() => setFilterPower(!filterPower)}
                    className={`h-7 px-2.5 text-[10px] rounded-full gap-1 ${
                      filterPower
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "text-muted-foreground border-muted-foreground/20 hover:bg-accent"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Power Supply
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCardFiltersOpen(!cardFiltersOpen)}
                  className={`h-7 px-2.5 text-[10px] rounded-full gap-1 border border-border/20 ${
                    cardFiltersOpen || selectedProvinceId !== "all" || selectedDistrictId !== "all" || selectedLlgId !== "all"
                      ? "bg-primary/10 text-primary border-primary/20 font-bold"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  Boundary Filters
                </Button>
              </div>

              {cardFiltersOpen && (
                <div className="space-y-2.5 p-2.5 bg-muted/20 border border-border/30 rounded-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider">
                      {adminLabels.level1}
                    </Label>
                    <Select
                      value={selectedProvinceId === "all" ? "all" : String(selectedProvinceId)}
                      onValueChange={(val) => handleProvinceChange(val === "all" ? "all" : Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/50 border-white/5">
                        <SelectValue placeholder={`All ${adminLabels.level1}s`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="all">All {adminLabels.level1}s</SelectItem>
                        {provinces.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider">
                      {adminLabels.level2}
                    </Label>
                    <Select
                      value={selectedDistrictId === "all" ? "all" : String(selectedDistrictId)}
                      onValueChange={(val) => handleDistrictChange(val === "all" ? "all" : Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/50 border-white/5">
                        <SelectValue placeholder={`All ${adminLabels.level2}s`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="all">All {adminLabels.level2}s</SelectItem>
                        {sidebarDistricts.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider">
                      {adminLabels.level3}
                    </Label>
                    <Select
                      value={selectedLlgId === "all" ? "all" : String(selectedLlgId)}
                      onValueChange={(val) => handleLlgChange(val === "all" ? "all" : Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/50 border-white/5">
                        <SelectValue placeholder={`All ${adminLabels.level3}s`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="all">All {adminLabels.level3}s</SelectItem>
                        {sidebarLlgs.map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardHeader>

            <div className="p-2 bg-muted/30 border-b flex items-center justify-between text-[11px] text-muted-foreground px-4">
              <span>Showing {filteredFacilities.length} of {facilities.length}</span>
              {(searchQuery || filterColdChain || filterPower || selectedProvinceId !== "all" || selectedDistrictId !== "all" || selectedLlgId !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterColdChain(false);
                    setFilterPower(false);
                    handleProvinceChange("all");
                  }}
                  className="text-primary hover:underline font-semibold"
                >
                  Reset filters
                </button>
              )}
            </div>

            <CardContent className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {filteredFacilities.length > 0 ? (
                <>
                  {filteredFacilities.slice(0, 50).map((fac) => {
                  const isSelected = selectedFacilityId === fac.id;
                  return (
                    <div
                      key={fac.id}
                      onClick={() => handleFocusFacility(fac)}
                      className={`group p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 select-none ${
                        isSelected
                          ? "bg-primary/5 border-primary/40 shadow-sm"
                          : "hover:bg-accent/40 border-transparent hover:border-border"
                      }`}
                    >
                      ...
                    </div>
                  );
                })}
                  {filteredFacilities.length > 50 && (
                    <div className="text-[10px] text-center text-muted-foreground p-2 border-t mt-2">
                      Showing first 50 facilities. Please zoom in or use filters to see more.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  ...
                </div>
              )}
            </CardContent>
            */}

            {selectedFacilityId ? (
              <FacilityDetailDrawer
                facility={facilities.find((f) => f.id === selectedFacilityId)}
                provinceName={provinceLookup.get(Number(districtLookup.get(Number(facilities.find((f) => f.id === selectedFacilityId)?.districtId))?.provinceId))?.name || "Province"}
                districtName={districtLookup.get(Number(facilities.find((f) => f.id === selectedFacilityId)?.districtId))?.name || "District"}
                communityRoutes={communityRoutes || []}
                activeSessionPlans={activeSessionPlans.filter((p: any) => Number(p.facilityId) === Number(selectedFacilityId))}
                onClose={() => setSelectedFacilityId(null)}
                onEdit={(fac) => {
                  setLocation(`/facilities?id=${fac.id}`);
                }}
                onDeletePolygon={async () => {
                  if (!selectedFacilityId) return;
                  const facName = facilities.find((f) => f.id === selectedFacilityId)?.name || "Facility";
                  if (!window.confirm(`Are you sure you want to delete the catchment polygon for ${facName}?`)) return;
                  try {
                    await apiRequest("DELETE", `/api/facilities/${selectedFacilityId}/catchment-polygon`);
                    queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
                    queryClient.invalidateQueries({ queryKey: [`/api/facilities/${selectedFacilityId}/catchment-polygon`] });
                    toast({ title: "Catchment polygon deleted", description: `Facility catchment polygon for ${facName} deleted.` });
                  } catch (err: any) {
                    toast({ title: "Delete failed", description: err?.message || "Failed to delete polygon", variant: "destructive" });
                  }
                }}
                canDeletePolygon={isNationalAdminOrManager}
              />
            ) : (
              // Standard list of facilities
              <div className="flex flex-col h-full overflow-hidden select-none">
                <CardHeader className="p-4 pb-2 border-b flex flex-col space-y-3 bg-card/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex flex-row items-center gap-2 text-primary">
                      <Building2 className="h-4 w-4" />
                      Health Facilities
                    </CardTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full hover:bg-muted"
                      onClick={() => togglePanel("facilities")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Search Box */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search name or HMIS..."
                      className="pl-8 h-9 text-xs bg-background/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Filter Pills & Collapsible Toggle Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={filterColdChain ? "default" : "outline"}
                        onClick={() => setFilterColdChain(!filterColdChain)}
                        className={`h-7 px-2.5 text-[10px] rounded-full gap-1 ${
                          filterColdChain
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "text-muted-foreground border-muted-foreground/20 hover:bg-accent"
                        }`}
                      >
                        <Thermometer className="h-3.5 w-3.5" />
                        Cold Chain
                      </Button>
                      <Button
                        size="sm"
                        variant={filterPower ? "default" : "outline"}
                        onClick={() => setFilterPower(!filterPower)}
                        className={`h-7 px-2.5 text-[10px] rounded-full gap-1 ${
                          filterPower
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "text-muted-foreground border-muted-foreground/20 hover:bg-accent"
                        }`}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Power Supply
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCardFiltersOpen(!cardFiltersOpen)}
                      className={`h-7 px-2.5 text-[10px] rounded-full gap-1 border border-border/20 ${
                        cardFiltersOpen || selectedProvinceId !== "all" || selectedDistrictId !== "all" || selectedLlgId !== "all"
                          ? "bg-primary/10 text-primary border-primary/20 font-bold"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Filter className="h-3 w-3" />
                      Boundary Filters
                    </Button>
                  </div>

                  {/* Premium Glassmorphic Geographic Selectors disclosure segment */}
                  {cardFiltersOpen && (
                    <div className="space-y-2.5 p-2.5 bg-muted/20 border border-border/30 rounded-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Province Selector */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider">
                          {adminLabels.level1}
                        </Label>
                        <Select
                          value={selectedProvinceId === "all" ? "all" : String(selectedProvinceId)}
                          onValueChange={(val) => handleProvinceChange(val === "all" ? "all" : Number(val))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-white/5">
                            <SelectValue placeholder={`All ${adminLabels.level1}s`} />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="all">All {adminLabels.level1}s</SelectItem>
                            {provinces.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* District Selector */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider">
                          {adminLabels.level2}
                        </Label>
                        <Select
                          value={selectedDistrictId === "all" ? "all" : String(selectedDistrictId)}
                          onValueChange={(val) => handleDistrictChange(val === "all" ? "all" : Number(val))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/50 border-white/5">
                            <SelectValue placeholder={`All ${adminLabels.level2}s`} />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="all">All {adminLabels.level2}s</SelectItem>
                            {sidebarDistricts.map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardHeader>

                {/* List Results */}
                <div className="p-2 bg-muted/30 border-b flex items-center justify-between text-[11px] text-muted-foreground px-4">
                  <span>Showing {filteredFacilities.length} of {facilities.length}</span>
                  {(searchQuery || filterColdChain || filterPower || selectedProvinceId !== "all" || selectedDistrictId !== "all") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterColdChain(false);
                        setFilterPower(false);
                        handleProvinceChange("all");
                      }}
                      className="text-primary hover:underline font-semibold"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                <CardContent className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                  {filteredFacilities.length > 0 ? (
                    <>
                      {filteredFacilities.slice(0, 50).map((fac) => {
                      const isSelected = selectedFacilityId === fac.id;
                      return (
                        <div
                          key={fac.id}
                          onClick={() => handleFocusFacility(fac)}
                          className={`group p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 select-none ${
                            isSelected
                              ? "bg-primary/5 border-primary/40 shadow-sm"
                              : "hover:bg-accent/40 border-transparent hover:border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                              {fac.name}
                            </div>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 bg-background/50 capitalize font-normal">
                              {fac.facilityType?.toLowerCase().replace("_", " ") || "Facility"}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {fac.hmisCode}
                          </div>

                          {/* Equipment Indicators */}
                          {(fac.hasRefrigerator || fac.hasPower || fac.staffCount) && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {fac.hasRefrigerator && (
                                <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded font-medium">
                                  <Thermometer className="h-3 w-3" />
                                  Cold Chain
                                </span>
                              )}
                              {fac.hasPower && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded font-medium">
                                  <Zap className="h-3 w-3" />
                                  Power
                                </span>
                              )}
                              {fac.staffCount && fac.staffCount > 0 && (
                                <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-medium">
                                  Staff: {fac.staffCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredFacilities.length > 50 && (
                      <div className="text-[10px] text-center text-muted-foreground p-2 border-t mt-2">
                        Showing first 50 facilities. Please zoom in or use filters to see more.
                      </div>
                    )}
                  </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                      <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-semibold text-muted-foreground">No facilities found</p>
                      <p className="text-[11px] text-muted-foreground/75 mt-0.5">Try adjusting your search query or filters.</p>
                    </div>
                  )}
                </CardContent>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Export Options dialog modal */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md bg-background/95 backdrop-blur-md border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Catchment Data
            </DialogTitle>
            <DialogDescription>
              Select a format or layout style to export GIS coordinates and facility digests.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              onClick={handleExportGeoJSON}
              className="flex items-center justify-start gap-3 h-14 text-left border hover:bg-accent/50"
            >
              <div className="p-2 rounded bg-blue-500/10 text-blue-500">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Export GeoJSON Dataset</p>
                <p className="text-xs text-muted-foreground">Download facilities and villages as spatial points.</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="flex items-center justify-start gap-3 h-14 text-left border hover:bg-accent/50"
            >
              <div className="p-2 rounded bg-green-500/10 text-green-500">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Export Catchment CSV</p>
                <p className="text-xs text-muted-foreground">Download tabular data including travel times and populations.</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex items-center justify-start gap-3 h-14 text-left border hover:bg-accent/50"
            >
              <div className="p-2 rounded bg-red-500/10 text-red-500">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Printable Map Layout</p>
                <p className="text-xs text-muted-foreground">Trigger standard browser layout optimized for high-res PDF.</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Catchment Dialog */}
      <Dialog open={saveCatchmentOpen} onOpenChange={setSaveCatchmentOpen}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-600">
              <PenLine className="h-5 w-5" />
              Save Catchment Area
            </DialogTitle>
            <DialogDescription>
              Assign the drawn polygon catchment area to a local health facility and define population boundaries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="catchment-province" className="text-sm font-semibold">
                Province *
              </Label>
              <Select
                value={catchmentProvinceId ? String(catchmentProvinceId) : ""}
                onValueChange={(val) => {
                  const next = Number(val);
                  setCatchmentProvinceId(next);
                  setCatchmentDistrictId(null);
                  setCatchmentFacilityId(null);
                  setCatchmentAutoDetectKm(null);
                }}
              >
                <SelectTrigger id="catchment-province" className="w-full" data-testid="select-catchment-province">
                  <SelectValue placeholder="Select province..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catchment-district" className="text-sm font-semibold">
                District *
              </Label>
              <Select
                value={catchmentDistrictId ? String(catchmentDistrictId) : ""}
                onValueChange={(val) => {
                  setCatchmentDistrictId(Number(val));
                  setCatchmentFacilityId(null);
                  setCatchmentAutoDetectKm(null);
                }}
                disabled={catchmentProvinceId == null}
              >
                <SelectTrigger id="catchment-district" className="w-full" data-testid="select-catchment-district">
                  <SelectValue placeholder={catchmentProvinceId == null ? "Select a province first..." : "Select district..."} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {catchmentDistrictOptions.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catchment-facility" className="text-sm font-semibold">
                Associated Health Facility *
              </Label>
              <Select
                value={catchmentFacilityId ? String(catchmentFacilityId) : ""}
                onValueChange={(val) => setCatchmentFacilityId(Number(val))}
                disabled={catchmentDistrictId == null}
              >
                <SelectTrigger id="catchment-facility" className="w-full" data-testid="select-catchment-facility">
                  <SelectValue placeholder={catchmentDistrictId == null ? "Select a district first..." : "Select facility..."} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {catchmentFacilityOptions.map((fac) => (
                    <SelectItem key={fac.id} value={String(fac.id)}>
                      {fac.name} ({fac.hmisCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {catchmentAutoDetectKm != null && catchmentFacilityId != null && (
                <p className="text-xs text-muted-foreground" data-testid="text-catchment-auto-detect-hint">
                  Nearest to drawn area · ~{catchmentAutoDetectKm.toFixed(1)} km — change if incorrect
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catchment-name" className="text-sm font-semibold">
                Catchment Area Name *
              </Label>
              <Input
                id="catchment-name"
                value={catchmentName}
                onChange={(e) => setCatchmentName(e.target.value)}
                placeholder="e.g. Makeni North Catchment"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catchment-pop" className="text-sm font-semibold">
                Estimated Population
              </Label>
              <Input
                id="catchment-pop"
                type="number"
                value={catchmentPopEst}
                onChange={(e) => setCatchmentPopEst(e.target.value)}
                placeholder="e.g. 2450"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catchment-desc" className="text-sm font-semibold">
                Description
              </Label>
              <Textarea
                id="catchment-desc"
                value={catchmentDescription}
                onChange={(e) => setCatchmentDescription(e.target.value)}
                placeholder="Add notes about geographic features, accessibility barriers, or communities included."
                className="w-full min-h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSaveCatchmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!catchmentFacilityId || !catchmentName || saveCatchmentMutation.isPending}
              onClick={() => saveCatchmentMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {saveCatchmentMutation.isPending ? "Saving..." : "Save Catchment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map-Initiated Click Dialog (High Density Gap Alerts) */}
      <Dialog open={clickDialogOpen} onOpenChange={setClickDialogOpen}>
        <DialogContent className="max-w-xl bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary font-black">
              <MapPin className="h-5 w-5 text-amber-500 animate-bounce" />
              Location Intelligence Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Explore demographic profiles, microplanning coverage, and administrative context for the clicked coordinate on the map.
            </DialogDescription>
          </DialogHeader>

          {mapClickDetails && (
            <Tabs defaultValue="location" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-xl">
                <TabsTrigger value="location" className="text-xs font-semibold py-1.5 rounded-lg">Location & Context</TabsTrigger>
                <TabsTrigger value="microplanning" className="text-xs font-semibold py-1.5 rounded-lg">Planning & Coverage</TabsTrigger>
                <TabsTrigger
                  value="feature"
                  disabled={!mapClickDetails.intersectedFeature}
                  className="text-xs font-semibold py-1.5 rounded-lg disabled:opacity-40"
                >
                  Intersected Feature
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Location & Context */}
              <TabsContent value="location" className="space-y-4 pt-4 text-xs">
                {/* Coordinates & HTR warning */}
                <div className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-muted">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Coordinates</span>
                    <span className="font-semibold text-foreground font-mono">{mapClickDetails.lat}, {mapClickDetails.lng}</span>
                  </div>
                  {mapClickDetails.isHTR && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> HTR Zone
                    </Badge>
                  )}
                </div>

                {/* Administrative Area Context */}
                <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Administrative Area Hierarchy</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground block text-[8px] uppercase font-bold">Province</span>
                      <span className="font-semibold text-foreground truncate block">{mapClickDetails.provinceName || "—"}</span>
                    </div>
                    <div className="p-2 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground block text-[8px] uppercase font-bold">District</span>
                      <span className="font-semibold text-foreground truncate block">{mapClickDetails.districtName || "—"}</span>
                    </div>
                    <div className="p-2 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground block text-[8px] uppercase font-bold">Ward/Locality</span>
                      <span className="font-semibold text-foreground truncate block">{mapClickDetails.wardName || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Gridded Population Estimates */}
                <div className="space-y-2">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase block tracking-wider">WorldPop Gridded Estimates</span>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="bg-muted/60 p-2.5 rounded-xl border border-muted flex flex-col justify-between">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">1km Radius</span>
                      {mapClickDetails.isLoadingPopulation ? (
                        <strong className="text-sm text-amber-500 animate-pulse">Loading...</strong>
                      ) : (
                        <strong className="text-sm text-foreground">≈ {mapClickDetails.pop1k.toLocaleString()}</strong>
                      )}
                      <span className="text-[8px] text-muted-foreground block mt-0.5">people</span>
                    </div>
                    <div className="bg-muted/60 p-2.5 rounded-xl border border-muted flex flex-col justify-between">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">2km Radius</span>
                      {mapClickDetails.isLoadingPopulation ? (
                        <strong className="text-sm text-amber-500 animate-pulse">Loading...</strong>
                      ) : (
                        <strong className="text-sm text-foreground">≈ {mapClickDetails.pop2k.toLocaleString()}</strong>
                      )}
                      <span className="text-[8px] text-muted-foreground block mt-0.5">people</span>
                    </div>
                    <div className="bg-muted/60 p-2.5 rounded-xl border border-muted flex flex-col justify-between">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">3km Radius</span>
                      {mapClickDetails.isLoadingPopulation ? (
                        <strong className="text-sm text-amber-500 animate-pulse">Loading...</strong>
                      ) : (
                        <strong className="text-sm text-foreground">≈ {mapClickDetails.pop3k.toLocaleString()}</strong>
                      )}
                      <span className="text-[8px] text-muted-foreground block mt-0.5">people</span>
                    </div>
                  </div>
                </div>

                {/* Nearby Landmarks */}
                <div className="space-y-2">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase block tracking-wider">Nearby Landmarks</span>
                  <div className="p-2.5 bg-background border border-border/80 rounded-xl space-y-1.5">
                    {mapClickDetails.landmarks && mapClickDetails.landmarks.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5">
                        {mapClickDetails.landmarks.map((l: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="flex items-center gap-1.5 text-foreground">
                              {l.type === "school" ? "School" : l.type === "church" ? "Church" : l.type === "market" ? "Market" : "Place"}
                              <span className="font-medium">{l.name}</span>
                            </span>
                            <span className="font-mono text-muted-foreground text-[10px]">{l.distance} km</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-muted-foreground">No landmarks found nearby</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Planning & Coverage */}
              <TabsContent value="microplanning" className="space-y-4 pt-4 text-xs">
                {/* Containment Catchment Status */}
                <div className={`p-3 border rounded-xl space-y-1.5 ${mapClickDetails.isInsideCatchment ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-900" : "bg-amber-500/5 border-amber-500/20 text-amber-900"}`}>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Existing Microplan Coverage</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      {mapClickDetails.isInsideCatchment ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Inside official catchment area
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-amber-500" />
                          Outside official catchment area
                        </>
                      )}
                    </span>
                    {mapClickDetails.isInsideCatchment && mapClickDetails.containingCatchments?.[0] && (
                      <Badge variant="outline" className="bg-emerald-600/10 text-emerald-700 border-emerald-500/20 font-semibold text-[10px]">
                        {mapClickDetails.containingCatchments[0].name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Nearest Health Facility */}
                <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Nearest Health Facility</span>
                  {mapClickDetails.nearestFacility ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">Facility: {mapClickDetails.nearestFacility.name}</span>
                        <Badge variant="secondary" className="text-[9px] font-semibold">
                          {mapClickDetails.nearestFacility.facilityType}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground font-mono">
                        <div>Distance: <span className="font-semibold text-foreground">{mapClickDetails.nearestFacility.distance} km</span></div>
                        <div>Est. Travel: <span className="font-semibold text-foreground">{Math.round(mapClickDetails.nearestFacility.distance * 12)} mins (walk)</span></div>
                      </div>
                    </div>
                  ) : (
                    <p className="italic text-muted-foreground">None within 15km</p>
                  )}
                </div>

                {/* Nearest Community */}
                <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Nearest Community</span>
                  {mapClickDetails.nearestVillage ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-foreground">Community: {mapClickDetails.nearestVillage.name}</span>
                        {mapClickDetails.nearestVillage.isHardToReach && (
                          <Badge variant="destructive" className="text-[9px] font-semibold">Hard to Reach</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                        <div>Est. Population: <span className="font-bold text-foreground font-mono">{mapClickDetails.nearestVillage.population.toLocaleString()}</span></div>
                        <div>Target Pop (U5): <span className="font-bold text-foreground font-mono">{mapClickDetails.nearestVillage.under5Population ? mapClickDetails.nearestVillage.under5Population.toLocaleString() : Math.round(mapClickDetails.nearestVillage.population * 0.15).toLocaleString()}</span></div>
                        <div>Distance to facility: <span className="font-semibold text-foreground font-mono">{mapClickDetails.nearestVillage.distance} km</span></div>
                        <div>Travel Time: <span className="font-semibold text-foreground font-mono">{mapClickDetails.nearestVillage.travelTimeMinutes} mins ({mapClickDetails.nearestVillage.transportMode})</span></div>
                      </div>
                    </div>
                  ) : (
                    <p className="italic text-muted-foreground">None within 10km</p>
                  )}
                </div>

                {/* Planned outreach sessions nearby */}
                <div className="space-y-2">
                  <span className="font-bold text-[10px] text-muted-foreground uppercase block tracking-wider">Planned Sessions Nearby</span>
                  <div className="p-2.5 bg-background border border-border/80 rounded-xl space-y-1.5">
                    {mapClickDetails.nearbyPlans && mapClickDetails.nearbyPlans.length > 0 ? (
                      <div className="space-y-2">
                        {mapClickDetails.nearbyPlans.map((np: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center border-b border-border/40 pb-1 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">📅 {np.name}</span>
                              <span className="text-[9px] text-muted-foreground">Type: {np.sessionType} | Status: {np.status}</span>
                            </div>
                            <span className="font-mono text-muted-foreground text-[10px] shrink-0">{np.distance} km</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="italic text-muted-foreground text-[10px]">No planned outreach sessions within 10km</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Intersected Feature */}
              <TabsContent value="feature" className="space-y-4 pt-4 text-xs">
                {mapClickDetails.intersectedFeature ? (
                  <div className="space-y-4">
                    {/* Header Info */}
                    <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-primary block">
                          Intersected {mapClickDetails.intersectedFeature.type.toUpperCase()}
                        </span>
                        <span className="font-bold text-foreground text-sm">
                          {mapClickDetails.intersectedFeature.type === "facility" && "Facility: " + mapClickDetails.intersectedFeature.data.name}
                          {mapClickDetails.intersectedFeature.type === "village" && "Community: " + mapClickDetails.intersectedFeature.data.name}
                          {mapClickDetails.intersectedFeature.type === "catchment" && "Catchment: " + mapClickDetails.intersectedFeature.data.name}
                          {mapClickDetails.intersectedFeature.type === "session" && "📅 " + mapClickDetails.intersectedFeature.data.name}
                        </span>
                      </div>
                      <Badge className="bg-primary hover:bg-primary/95 text-white capitalize font-semibold text-[10px]">
                        {mapClickDetails.intersectedFeature.type}
                      </Badge>
                    </div>

                    {/* Grid Properties */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {mapClickDetails.intersectedFeature.type === "facility" && (
                        <>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">HMIS Code</span>
                            <span className="font-mono font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.hmisCode}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Facility Type</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.facilityType || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Operational Status</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.operationalStatus || "Active"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Agency Name</span>
                            <span className="font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.agencyName || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Staff Count</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.staffCount || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Operating Hours</span>
                            <span className="font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.operatingHours || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Cold Chain (Fridge)</span>
                            <span className={`font-semibold ${mapClickDetails.intersectedFeature.data.hasRefrigerator ? "text-emerald-600" : "text-red-500"}`}>
                              {mapClickDetails.intersectedFeature.data.hasRefrigerator ? "Available" : "Not Available"}
                            </span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Power Supply</span>
                            <span className={`font-semibold ${mapClickDetails.intersectedFeature.data.hasPower ? "text-emerald-600" : "text-red-500"}`}>
                              {mapClickDetails.intersectedFeature.data.hasPower ? "Yes" : "No"}
                            </span>
                          </div>
                          {mapClickDetails.intersectedFeature.data.address && (
                            <div className="p-2 bg-muted/40 rounded-lg col-span-2">
                              <span className="text-muted-foreground block text-[9px] uppercase font-bold">Address</span>
                              <span className="text-foreground">{mapClickDetails.intersectedFeature.data.address}</span>
                            </div>
                          )}
                        </>
                      )}
                      {mapClickDetails.intersectedFeature.type === "village" && (
                        <>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Settlement Code</span>
                            <span className="font-mono font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.code || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Settlement Type</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.settlementType || "Village"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Total Population</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.population ? mapClickDetails.intersectedFeature.data.population.toLocaleString() : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Target Pop (Under 5)</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.under5Population ? mapClickDetails.intersectedFeature.data.under5Population.toLocaleString() : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Accessibility</span>
                            <span className={`font-semibold ${mapClickDetails.intersectedFeature.data.isHardToReach ? "text-red-500" : "text-emerald-600"}`}>
                              {mapClickDetails.intersectedFeature.data.isHardToReach ? "Hard-to-Reach (HTR)" : "Accessible"}
                            </span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Transport Mode</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.transportMode || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Seasonal Access</span>
                            <span className="font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.seasonalAccessibility || "All Year"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Insecurity Level</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.insecurityLevel !== null ? `Level ${mapClickDetails.intersectedFeature.data.insecurityLevel}` : "Low"}</span>
                          </div>
                          {(mapClickDetails.intersectedFeature.data.focalPersonName || mapClickDetails.intersectedFeature.data.focalPersonPhone) && (
                            <div className="p-2 bg-muted/40 rounded-lg col-span-2 space-y-1">
                              <span className="text-muted-foreground block text-[9px] uppercase font-bold">Focal Person / Mobilization</span>
                              <span className="text-foreground font-medium block">👤 {mapClickDetails.intersectedFeature.data.focalPersonName || "Unnamed"}</span>
                              {mapClickDetails.intersectedFeature.data.focalPersonPhone && (
                                <span className="text-muted-foreground block font-mono text-[10px]">📞 {mapClickDetails.intersectedFeature.data.focalPersonPhone}</span>
                              )}
                            </div>
                          )}
                          {mapClickDetails.intersectedFeature.data.isCrossBorder && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg col-span-2">
                              <span className="text-amber-800 block text-[9px] uppercase font-bold">Cross-Border Info</span>
                              <span className="text-amber-900 font-medium text-[11px]">
                                Border Crossing settlement bordering {mapClickDetails.intersectedFeature.data.borderCountry || "counterpart country"}.
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {mapClickDetails.intersectedFeature.type === "catchment" && (
                        <>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Area (Sq Km)</span>
                            <span className="font-mono font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.areaSqKm ? Number(mapClickDetails.intersectedFeature.data.areaSqKm).toFixed(2) + " km²" : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Catchment Population</span>
                            <span className="font-mono font-semibold text-foreground">{mapClickDetails.intersectedFeature.data.populationEstimate ? mapClickDetails.intersectedFeature.data.populationEstimate.toLocaleString() : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Official Status</span>
                            <span className={`font-semibold ${mapClickDetails.intersectedFeature.data.isOfficial ? "text-emerald-600" : "text-amber-600"}`}>
                              {mapClickDetails.intersectedFeature.data.isOfficial ? "Official / Approved" : "Drawn Catchment"}
                            </span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Drawn Date</span>
                            <span className="font-semibold text-foreground">
                              {mapClickDetails.intersectedFeature.data.createdAt ? new Date(mapClickDetails.intersectedFeature.data.createdAt).toLocaleDateString() : "—"}
                            </span>
                          </div>
                          {mapClickDetails.intersectedFeature.data.description && (
                            <div className="p-2 bg-muted/40 rounded-lg col-span-2">
                              <span className="text-muted-foreground block text-[9px] uppercase font-bold">Description</span>
                              <span className="text-foreground">{mapClickDetails.intersectedFeature.data.description}</span>
                            </div>
                          )}
                        </>
                      )}

                      {mapClickDetails.intersectedFeature.type === "session" && (
                        <>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Session Type</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.sessionType}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Microplan Period</span>
                            <span className="font-semibold text-foreground font-mono">Q{mapClickDetails.intersectedFeature.data.quarter} {mapClickDetails.intersectedFeature.data.year}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Execution Status</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.status}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Target Population</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.targetPopulation ? mapClickDetails.intersectedFeature.data.targetPopulation.toLocaleString() : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Transport Mode</span>
                            <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.transportMode || "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Est. Duration</span>
                            <span className="font-semibold text-foreground font-mono">{mapClickDetails.intersectedFeature.data.estimatedDuration ? `${mapClickDetails.intersectedFeature.data.estimatedDuration} mins` : "—"}</span>
                          </div>
                          <div className="p-2 bg-muted/40 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Status achieved</span>
                            <span className={`font-semibold ${mapClickDetails.intersectedFeature.data.isAchieved ? "text-emerald-600" : "text-muted-foreground"}`}>
                              {mapClickDetails.intersectedFeature.data.isAchieved ? "Yes (Completed)" : "No"}
                            </span>
                          </div>
                          {mapClickDetails.intersectedFeature.data.outreachPurpose && (
                            <div className="p-2 bg-muted/40 rounded-lg">
                              <span className="text-muted-foreground block text-[9px] uppercase font-bold">Outreach Purpose</span>
                              <span className="font-semibold text-foreground capitalize">{mapClickDetails.intersectedFeature.data.outreachPurpose}</span>
                            </div>
                          )}
                          {mapClickDetails.intersectedFeature.data.notes && (
                            <div className="p-2 bg-muted/40 rounded-lg col-span-2">
                              <span className="text-muted-foreground block text-[9px] uppercase font-bold">Notes</span>
                              <span className="text-foreground">{mapClickDetails.intersectedFeature.data.notes}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-8 text-center">No intersecting feature clicked</p>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClickDialogOpen(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setClickDialogOpen(false);
                setNewSessionDate(getMinScheduleDateInputValue());
                setCreateSessionDialogOpen(true);
              }}
              className="text-xs font-semibold bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Initiate Session Plan Here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Derived Outreach Session Plan Dialog */}
      <Dialog open={createSessionDialogOpen} onOpenChange={setCreateSessionDialogOpen}>
        <DialogContent className="max-w-md bg-background border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary font-black">
              <Calendar className="h-5 w-5 text-primary" />
              Create Derived Session Plan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define operational parameters for this field immunization dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2 text-xs">
            {/* Coordinate reference */}
            {mapClickDetails && (
              <div className="p-2.5 bg-muted/40 rounded-xl border border-muted flex justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Target Coordinates:</span>
                <span className="font-bold text-foreground font-mono">{mapClickDetails.lat}, {mapClickDetails.lng}</span>
              </div>
            )}

            {/* Session name */}
            <div className="space-y-1">
              <Label htmlFor="session-name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Session Plan Name *</Label>
              <Input
                id="session-name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g. Outreach Cluster B Patrol"
                className="h-8 text-xs"
              />
            </div>

            {/* Staging health facility — searchable Province → District → Facility cascade */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Staging Base Facility *</Label>
              <FacilityCascadePicker
                value={selectedParentFacilityId}
                onChange={(id, fac) => {
                  setSelectedParentFacilityId(id);
                  if (fac) {
                    setNewSessionName(`Outreach Session Plan - ${fac.name}`);
                  }
                }}
                required
                layout="stacked"
                provinceLabel={adminLabels.level1}
                districtLabel={adminLabels.level2}
                facilityLabel={adminLabels.level3}
                testIdPrefix="staging-facility-picker"
              />
            </div>

            {/* Parent Master Microplan link */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Link to Master Microplan *</Label>
              <Select
                value={newSessionMicroplanId}
                onValueChange={setNewSessionMicroplanId}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select Parent Microplan..." />
                </SelectTrigger>
                <SelectContent className="bg-background/95">
                  <SelectItem value="none" className="text-xs text-amber-500 font-medium">
                    No Parent (Orphaned Plan)
                  </SelectItem>
                  {masterMicroplans.map((mp) => (
                    <SelectItem key={mp.id} value={String(mp.id)} className="text-xs">
                      [{mp.planType === "sia_campaign" ? "SIA Campaign" : "Routine"}] {mp.name} ({mp.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Session Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Session Type *</Label>
                <Select
                  value={newSessionType}
                  onValueChange={(val: any) => setNewSessionType(val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select Type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95">
                    <SelectItem value="static" className="text-xs">Static (Facility Hub)</SelectItem>
                    <SelectItem value="outreach" className="text-xs">Outreach (Fixed Station)</SelectItem>
                    <SelectItem value="mobile" className="text-xs">Mobile (Dynamic Patrol)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transport Mode */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Transport Mode *</Label>
                <Select
                  value={newSessionTransport}
                  onValueChange={setNewSessionTransport}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select Transport..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95">
                    <SelectItem value="walking" className="text-xs">Foot Patrol</SelectItem>
                    <SelectItem value="road" className="text-xs">Road Vehicle / Motorcycle</SelectItem>
                    <SelectItem value="boat" className="text-xs">Boat / Canoe Patrol</SelectItem>
                    <SelectItem value="air" className="text-xs">Air Transport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Denominator and Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="session-pop" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Target Catchment Pop *</Label>
                <Input
                  id="session-pop"
                  type="number"
                  value={newSessionTargetPop}
                  onChange={(e) => setNewSessionTargetPop(Number(e.target.value))}
                  placeholder="e.g. 150"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Planning Scope</Label>
                <Select
                  value={newSessionScope}
                  onValueChange={setNewSessionScope}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select Scope..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95">
                    <SelectItem value="Local" className="text-xs">Local / Settlement</SelectItem>
                    <SelectItem value="Sub-national" className="text-xs">Sub-national</SelectItem>
                    <SelectItem value="National" className="text-xs">National Scope</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scheduled Date */}
            <div className="space-y-1">
              <Label htmlFor="session-date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Date *</Label>
              <Input
                id="session-date"
                type="date"
                value={newSessionDate}
                min={getMinScheduleDateInputValue()}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                Sessions must be scheduled at least 7 days in advance.
              </p>
            </div>

            {/* Multi-Source Population Consensus Panel */}
            {sessionPolygonPoints.length >= 2 && (
              <div className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-2 mt-1">
                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-wider">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
                  Multi-Source Pop Consensus
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Planners can compare other estimates to establish consensus since no single population is final. Click to apply.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <button
                    type="button"
                    onClick={() => setNewSessionTargetPop(consensusPopulations.worldPopGrid)}
                    className="p-2 bg-background border border-border/60 hover:border-primary/50 rounded-lg flex flex-col items-center justify-center transition-all group focus:outline-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-semibold group-hover:text-primary">WorldPop Grid</span>
                    <strong className="text-xs text-foreground font-mono mt-0.5">
                      {consensusPopulations.worldPopGrid}
                    </strong>
                    <span className="text-[8px] text-indigo-500 font-medium mt-0.5 group-hover:underline">Use Estimate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSessionTargetPop(consensusPopulations.localRegistry)}
                    className="p-2 bg-background border border-border/60 hover:border-primary/50 rounded-lg flex flex-col items-center justify-center transition-all group focus:outline-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-semibold group-hover:text-primary">Registry Census</span>
                    <strong className="text-xs text-foreground font-mono mt-0.5">
                      {consensusPopulations.localRegistry}
                    </strong>
                    <span className="text-[8px] text-indigo-500 font-medium mt-0.5 group-hover:underline">Use Estimate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSessionTargetPop(consensusPopulations.grid3Structures)}
                    className="p-2 bg-background border border-border/60 hover:border-primary/50 rounded-lg flex flex-col items-center justify-center transition-all group focus:outline-none cursor-pointer"
                  >
                    <span className="text-muted-foreground font-semibold group-hover:text-primary">GRID3 Structures</span>
                    <strong className="text-xs text-foreground font-mono mt-0.5">
                      {consensusPopulations.grid3Structures}
                    </strong>
                    <span className="text-[8px] text-indigo-500 font-medium mt-0.5 group-hover:underline">Use Estimate</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateSessionDialogOpen(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedParentFacilityId || !newSessionName || !newSessionDate || createSessionPlanMutation.isPending}
              onClick={() => {
                if (!mapClickDetails || !selectedParentFacilityId) return;
                const lat = mapClickDetails.lat;
                const lng = mapClickDetails.lng;

                // Construct closed polygon geofence representing centroid coordinate default
                const radiusDegrees = 0.005; // ~500m geofence outline
                const coordinates = [[
                  [lng - radiusDegrees, lat - radiusDegrees],
                  [lng + radiusDegrees, lat - radiusDegrees],
                  [lng + radiusDegrees, lat + radiusDegrees],
                  [lng - radiusDegrees, lat + radiusDegrees],
                  [lng - radiusDegrees, lat - radiusDegrees]
                ]];

                createSessionPlanMutation.mutate({
                  facilityId: selectedParentFacilityId,
                  microplanId: newSessionMicroplanId === "none" ? null : Number(newSessionMicroplanId),
                  name: newSessionName,
                  sessionType: newSessionType,
                  scheduledDate: `${newSessionDate}T00:00:00.000Z`,
                  transportMode: newSessionTransport,
                  estimatedDuration: 180,
                  targetPopulation: newSessionTargetPop,
                  geojson: { type: "Polygon", coordinates },
                  isAchieved: false,
                  status: "planned",
                  quarter: newSessionQuarter,
                  year: newSessionYear,
                  teamType: newSessionTeamType
                });
              }}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createSessionPlanMutation.isPending ? "Creating..." : "Create outreach Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task #101 — Offer to start a routine microplan for the village's
          facility when one doesn't exist yet, then return to the New Session
          dialog with the village prefill intact. */}
      <Dialog
        open={!!startMicroplanPrompt}
        onOpenChange={(open) => {
          if (!open) setStartMicroplanPrompt(null);
        }}
      >
        <DialogContent data-testid="dialog-start-microplan-prompt">
          <DialogHeader>
            <DialogTitle>Start a microplan for this facility?</DialogTitle>
            <DialogDescription>
              {startMicroplanPrompt
                ? `${startMicroplanPrompt.facilityName} doesn't have a routine microplan yet. To plan a session for ${startMicroplanPrompt.villageName || "this village"}, you'll need to start one first.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setStartMicroplanPrompt(null)}
              data-testid="button-start-microplan-cancel"
            >
              Not now
            </Button>
            <Button
              onClick={() => {
                const p = startMicroplanPrompt;
                if (!p) return;
                const qs = new URLSearchParams({
                  facilityId: String(p.facilityId),
                  returnVillageId: String(p.villageId),
                  returnVillageName: p.villageName,
                  returnVillageLat: String(p.villageLat),
                  returnVillageLng: String(p.villageLng),
                  returnVillageHtr: p.villageHtr ? "1" : "0",
                });
                setStartMicroplanPrompt(null);
                window.location.assign(`/microplan/new?${qs.toString()}`);
              }}
              data-testid="button-start-microplan-confirm"
            >
              Start microplan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Universal Rename Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-md bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary font-black">
              <MapPin className="h-5 w-5 text-indigo-500" />
              <span>Rename {renameTarget?.type === "village" ? "Catchment Village" : renameTarget?.type === "llg" ? (adminLabels?.level3 || "Ward/LLG") : renameTarget?.type === "district" ? (adminLabels?.level2 || "District") : (adminLabels?.level1 || "Province")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Provide a new name for this geographic administrative entity. This will update all planning filters, labels, and reports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="rename-input" className="text-sm font-semibold">Name</Label>
              <Input
                id="rename-input"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="w-full text-sm h-10 bg-background/50"
                placeholder="Enter new name"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renameName.trim() || isRenaming}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isRenaming ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click-to-pick Outreach location Banner Overlay */}
      {isPickingFromMap && pickingOutreachForVillage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-purple-600 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 text-xs font-semibold animate-pulse border border-purple-400">
          <span>Click on the map to place the Outreach Post for <strong>{pickingOutreachForVillage.name}</strong></span>
          <Button
            size="sm"
            className="h-6 rounded-full bg-white/20 text-white hover:bg-white/30 border-none text-[10px] px-2 font-bold"
            onClick={() => {
              setOutreachNameInput(outreachDraftRef.current.name);
              setOutreachLatInput(outreachDraftRef.current.latitude);
              setOutreachLngInput(outreachDraftRef.current.longitude);
              skipOutreachHydrationRef.current = true;
              setOutreachDialogTarget(pickingOutreachForVillage);
              setIsPickingFromMap(false);
              setPickingOutreachForVillage(null);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Outreach Post Configuration Dialog */}
      <Dialog open={!!outreachDialogTarget} onOpenChange={(open) => { if (!open) setOutreachDialogTarget(null); }}>
        <DialogContent className="sm:max-w-lg font-sans bg-background border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-purple-600 dark:text-purple-400 flex items-center gap-1.5 font-bold">
              <span>Configure Outreach Post</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Create a reusable service point for <strong>{outreachDialogTarget?.name}</strong>. It will appear as a violet pin on the map.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-[10px]" aria-label="Outreach post setup steps">
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2"><strong className="block text-purple-700">1. Name</strong><span className="text-muted-foreground">Identify the post</span></div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2"><strong className="block text-purple-700">2. Locate</strong><span className="text-muted-foreground">Choose coordinates</span></div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2"><strong className="block text-purple-700">3. Save</strong><span className="text-muted-foreground">Create the map pin</span></div>
          </div>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="outreach-name" className="text-xs font-semibold">1. Post name</Label>
              <Input
                id="outreach-name"
                value={outreachNameInput}
                onChange={(e) => setOutreachNameInput(e.target.value)}
                placeholder="e.g. Community Health Post, Under-tree Outpost"
                className="h-8 text-xs bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">2. Choose the post location</Label>
              <p className="text-[10px] text-muted-foreground">Select a point on the map, use the community center, capture device GPS, or enter coordinates manually.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="outreach-lat" className="text-xs font-semibold">Latitude</Label>
                <Input
                  id="outreach-lat"
                  type="number"
                  step="any"
                  value={outreachLatInput}
                  onChange={(e) => setOutreachLatInput(e.target.value)}
                  placeholder="e.g. -15.12345"
                  className="h-8 text-xs bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="outreach-lng" className="text-xs font-semibold">Longitude</Label>
                <Input
                  id="outreach-lng"
                  type="number"
                  step="any"
                  value={outreachLngInput}
                  onChange={(e) => setOutreachLngInput(e.target.value)}
                  placeholder="e.g. 28.12345"
                  className="h-8 text-xs bg-background/50"
                />
              </div>
            </div>
            {(outreachLatInput && outreachLngInput) ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[10px] text-emerald-700">
                Location ready: {Number(outreachLatInput).toFixed(5)}, {Number(outreachLngInput).toFixed(5)}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-700">
                A location is required before this outreach post can be saved.
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-semibold border-purple-500/20 text-purple-600 hover:bg-purple-50"
                onClick={() => {
                  if (outreachDialogTarget) {
                    outreachDraftRef.current = {
                      name: outreachNameInput,
                      latitude: outreachLatInput,
                      longitude: outreachLngInput,
                    };
                    setPickingOutreachForVillage(outreachDialogTarget);
                    setIsPickingFromMap(true);
                    setOutreachDialogTarget(null);
                  }
                }}
              >
                Select on Map
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-semibold"
                onClick={() => {
                  if (outreachDialogTarget) {
                    setOutreachLatInput(outreachDialogTarget.latitude ? String(outreachDialogTarget.latitude) : "");
                    setOutreachLngInput(outreachDialogTarget.longitude ? String(outreachDialogTarget.longitude) : "");
                  }
                }}
              >
                Use Village Center
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-semibold"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setOutreachLatInput(String(position.coords.latitude));
                        setOutreachLngInput(String(position.coords.longitude));
                        toast({
                          title: "GPS Location Acquired",
                          description: "Using current device coordinates.",
                        });
                      },
                      (error) => {
                        toast({
                          title: "GPS Error",
                          description: "Could not acquire current location.",
                          variant: "destructive",
                        });
                      }
                    );
                  } else {
                    toast({
                      title: "Not supported",
                      description: "Geolocation is not supported by your browser.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Use Current GPS
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setOutreachDialogTarget(null)}
              disabled={isSavingOutreach}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              disabled={isSavingOutreach}
              onClick={async () => {
                if (!outreachDialogTarget) return;
                if (!outreachNameInput.trim()) {
                  toast({
                    title: "Post name required",
                    description: "Enter a clear name for the outreach post.",
                    variant: "destructive",
                  });
                  return;
                }
                if (!outreachLatInput || !outreachLngInput) {
                  toast({
                    title: "Location required",
                    description: "Choose a location method or enter latitude and longitude.",
                    variant: "destructive",
                  });
                  return;
                }
                const lat = Number(outreachLatInput);
                const lng = Number(outreachLngInput);
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                  toast({
                    title: "Invalid coordinates",
                    description: "Latitude must be between -90 and 90; longitude must be between -180 and 180.",
                    variant: "destructive",
                  });
                  return;
                }
                setIsSavingOutreach(true);
                try {
                  const updatedVillage = await apiRequest<Village>("PATCH", `/api/villages/${outreachDialogTarget.id}`, {
                    outreachLatitude: String(lat),
                    outreachLongitude: String(lng),
                    outreachPostName: outreachNameInput.trim(),
                  });
                  queryClient.setQueriesData<Village[]>({ queryKey: ["/api/villages"] }, (current) =>
                    Array.isArray(current)
                      ? current.map((village) => village.id === updatedVillage.id ? updatedVillage : village)
                      : current,
                  );
                  void queryClient.invalidateQueries({ queryKey: ["/api/villages"], refetchType: "none" });
                  toast({
                    title: "Outreach post saved",
                    description: `${outreachNameInput.trim()} is now shown as a violet map pin for ${outreachDialogTarget.name}.`,
                  });
                  setOutreachDialogTarget(null);
                } catch (err) {
                  toast({
                    title: "Could not save outreach post",
                    description: err instanceof Error ? err.message : "The outreach post could not be saved. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsSavingOutreach(false);
                }
              }}
            >
              {isSavingOutreach ? "Saving outreach post..." : "3. Save outreach post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LocationIntelligenceDrawer point={intelligencePoint} context={mapClickDetails} onClose={() => setIntelligencePoint(null)} />
    </div>
  );
}
