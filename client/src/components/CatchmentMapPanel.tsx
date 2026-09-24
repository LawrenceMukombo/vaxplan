/**
 * CatchmentMapPanel - Smart Interactive polygon drawing tool for HF catchments & communities
 *
 * Workflow:
 *  - STEP 1 (Mandatory First Step): Draw Health Facility Catchment Boundary.
 *    Once established, gridded WorldPop population is calculated and locked.
 *  - STEP 2: Demarcate Community Sub-Polygons inside the established HF catchment.
 *    Includes real-time vertex/edge snapping, containment checks, 1-click auto-clipping,
 *    and instant multi-user synchronization.
 *  - STEP 3: Missed Communities & Gap Intelligence (Zero-dose identification & interior void detection).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer, Polygon, Marker, Popup, GeoJSON, CircleMarker, useMap,
} from "react-leaflet";
import L from "leaflet";
import { usePersistedBasemap, BasemapTileLayer, BasemapSwitcher } from "@/components/map/BasemapToggle";
import * as turf from "@turf/turf";
import type {
  Feature as GeoJSONFeature,
  Polygon as GeoJSONPolygon,
  MultiPolygon as GeoJSONMultiPolygon,
} from "geojson";

import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasAnyPermission } from "@/lib/accessControl";
import { PolygonIntelligenceCard, type IntelligenceResult } from "@/components/PolygonIntelligenceCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Scissors,
  Crosshair,
  Lock,
  Unlock,
  Check,
  RotateCcw,
  Trash2,
  Compass,
  Eye,
  ShieldCheck,
  Info,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

// --- Colour palette for community polygons ------------------------------------
const PALETTE = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a",
  "#ff5722", "#607d8b", "#795548", "#ff9800", "#4caf50",
];

// --- Types -------------------------------------------------------------------
type PolygonAccessMetrics = {
  centroidDistanceKm?: number | null;
  travelTimeWalkingMin?: number | null;
  travelTimeMotorcycleMin?: number | null;
  travelTimeVehicleMin?: number | null;
};

type PolygonPlanningMeta = {
  areaSqKm?: number | null;
  populationEstimate?: number;
  centroid?: { latitude: number; longitude: number } | null;
  targetInfants?: number;
  underOne?: number;
  underFive?: number;
  womenOfChildbearingAge?: number;
  populationSource?: string;
  populationSourceYear?: number;
  populationMethod?: string;
  confidence?: string;
  populationStatus?: string;
  validationStatus?: string;
  approvalStatus?: string;
  calculatedAt?: string;
  access?: PolygonAccessMetrics | null;
  warnings?: string[];
};

export interface CommunityPolygon extends PolygonPlanningMeta {
  communityId?: number;
  communityName: string;
  color: string;
  coords: [number, number][];
  griddedPopulation?: number;
  under5Population?: number;
  saved: boolean;
}

export interface CatchmentPolygon extends PolygonPlanningMeta {
  coords: [number, number][];
  gridPopulation?: number;
  under5Population?: number;
  locked: boolean;
}

type LifecycleAction = "edit" | "replace";
type LifecycleEntity = { entityType: "facility" | "village"; entityId: number; action: LifecycleAction; originalCoords: [number, number][] };
type LifecycleValidation = {
  valid: boolean;
  blockingErrors: Array<{ code: string; message: string; geometry?: any }>;
  warnings: Array<{ code: string; message: string; geometry?: any }>;
  information: Array<{ code: string; message: string }>;
  areaSqKm?: number;
  centroid?: { latitude: number; longitude: number } | null;
};
type LifecycleVersion = {
  id: number;
  version: number;
  status: string;
  approvalStatus?: string | null;
  changeType?: string | null;
  changeReason?: string | null;
  areaSqKm?: string | number | null;
  populationEstimate?: number | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  validFrom?: string | null;
  createdAt?: string | null;
  geometry?: any;
};
interface ExtractResult {
  villages: Array<{ id: number; name: string; latitude?: number; longitude?: number }>;
  settlements: Array<{ id: number; name: string; latitude: number; longitude: number; populationEstimate?: number }>;
  unmapped: Array<{ name: string; latitude: number; longitude: number; placeType: string; osmId?: string }>;
  counts: { villages: number; settlements: number; unmapped: number };
}

interface Props {
  facilityId: number;
  facilityName: string;
  facilityLat?: number;
  facilityLng?: number;
  communities: {
    id?: number;
    villageId?: number;
    name: string;
    latitude?: number;
    longitude?: number;
    targetPopulation?: string;
  }[];
  onCommunityPopUpdate: (name: string, population: number) => void;
  onExtractedCommunities?: (names: string[]) => void;
}

// --- Convert [lat,lng] coords array to GeoJSON Polygon ring ------------------
function toGeoRing(coords: [number, number][]): [number, number][] {
  if (!coords || coords.length === 0) return [];
  const ring: [number, number][] = coords.map(([lat, lng]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function geometryFromGeoJson(input: any): any | null {
  if (!input) return null;
  if (input.type === "Feature") return input.geometry ?? null;
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;
  return null;
}

function polygonProps(input: any): PolygonPlanningMeta {
  return input?.type === "Feature" && input.properties ? input.properties : {};
}

function coordsFromGeoJson(input: any): [number, number][] | null {
  const geometry = geometryFromGeoJson(input);
  if (!geometry?.coordinates) return null;
  const ring = geometry.type === "MultiPolygon" ? geometry.coordinates?.[0]?.[0] : geometry.coordinates?.[0];
  return Array.isArray(ring) ? ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]) : null;
}

function metaFromResponse(res: any): PolygonPlanningMeta {
  const metadataProps = polygonProps(res?.metadata?.geometry);
  const polygonMetaProps = polygonProps(res?.catchmentPolygon);
  const props = Object.keys(metadataProps).length ? metadataProps : polygonMetaProps;
  return {
    ...props,
    areaSqKm: res?.areaSqKm ?? props.areaSqKm ?? res?.metadata?.areaSqKm,
    centroid: res?.centroid ?? props.centroid,
    access: res?.access ?? props.access,
    populationEstimate: res?.population?.totalPopulation ?? props.populationEstimate,
    targetInfants: res?.population?.targetInfants ?? props.targetInfants,
    underOne: res?.population?.underOne ?? props.underOne,
    underFive: res?.population?.underFive ?? props.underFive,
    womenOfChildbearingAge: res?.population?.womenOfChildbearingAge ?? props.womenOfChildbearingAge,
    populationSource: res?.population?.source ?? props.populationSource,
    populationSourceYear: res?.population?.sourceYear ?? props.populationSourceYear,
    populationMethod: res?.population?.method ?? props.populationMethod,
    confidence: res?.population?.confidence ?? props.confidence,
    populationStatus: res?.population?.status ?? props.populationStatus,
    calculatedAt: res?.population?.calculatedAt ?? props.calculatedAt,
    validationStatus: res?.validationStatus ?? props.validationStatus,
    approvalStatus: res?.approvalStatus ?? props.approvalStatus,
    warnings: res?.warnings ?? props.warnings,
  };
}

function localPolygonMeta(coords: [number, number][], facilityLat: number, facilityLng: number): PolygonPlanningMeta {
  try {
    const ring = toGeoRing(coords);
    if (ring.length < 4) return { validationStatus: "draft", approvalStatus: "draft" };
    const feature = turf.polygon([ring]);
    const center = turf.centroid(feature);
    const [longitude, latitude] = center.geometry.coordinates;
    const distanceKm = turf.distance(turf.point([facilityLng, facilityLat]), turf.point([longitude, latitude]), { units: "kilometers" });
    return {
      areaSqKm: turf.area(feature) / 1_000_000,
      centroid: { latitude, longitude },
      access: {
        centroidDistanceKm: Number(distanceKm.toFixed(2)),
        travelTimeWalkingMin: Math.round((distanceKm / 4) * 60),
        travelTimeMotorcycleMin: Math.round((distanceKm / 25) * 60),
        travelTimeVehicleMin: Math.round((distanceKm / 40) * 60),
      },
      validationStatus: "valid",
      approvalStatus: "draft",
      populationMethod: "GeoTIFF grid calculation",
      confidence: "high",
    };
  } catch {
    return { validationStatus: "draft", approvalStatus: "draft" };
  }
}

// --- Population estimation (server-side + cascade) ---------------------------
async function estimatePolygonPop(
  coords: [number, number][],
  ownerType?: "facility" | "village",
  ownerId?: number
): Promise<IntelligenceResult | null> {
  const ring = toGeoRing(coords);
  if (ring.length < 4) return null;
  const geojson = { type: "Polygon", coordinates: [ring] };

  try {
    const r = await apiRequest<IntelligenceResult>("POST", "/api/gis/polygons/intelligence", { geometry: geojson, ownerType, ownerId });
    return r;
  } catch (e) {
    console.error("Intelligence API failed:", e);
    return null;
  }
}

// --- Snapping helper: snaps coordinate to nearest point within pixel threshold ---
function findSnapPoint(lat: number, lng: number, snapPoints: [number, number][], map: L.Map, snapPixelThreshold = 18): [number, number] {
  if (!snapPoints || snapPoints.length === 0) return [lat, lng];
  const mousePt = map.latLngToLayerPoint(L.latLng(lat, lng));
  let closest: [number, number] = [lat, lng];
  let minDistance = Infinity;

  for (const [sLat, sLng] of snapPoints) {
    const sPt = map.latLngToLayerPoint(L.latLng(sLat, sLng));
    const dist = mousePt.distanceTo(sPt);
    if (dist <= snapPixelThreshold && dist < minDistance) {
      minDistance = dist;
      closest = [sLat, sLng];
    }
  }

  return closest;
}

// --- Drawing controller with live snapping, vertex placement, undo, and finish triggers ---
function DrawingController({
  mode,
  onClose,
  onPolygonComplete,
  snapCoords = [],
  allowedBoundary,
  onInvalidPoint,
  onPointCountChange,
  finishTriggerRef,
}: {
  mode: "catchment" | "community" | null;
  onClose: () => void;
  onPolygonComplete: (coords: [number, number][]) => void;
  snapCoords?: [number, number][];
  allowedBoundary?: [number, number][];
  onInvalidPoint?: () => void;
  onPointCountChange?: (count: number) => void;
  finishTriggerRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const map = useMap();
  const pointsRef = useRef<[number, number][]>([]);
  const lgRef = useRef<L.LayerGroup | null>(null);
  const snapMarkerRef = useRef<L.CircleMarker | null>(null);

  const onPolygonCompleteRef = useRef(onPolygonComplete);
  onPolygonCompleteRef.current = onPolygonComplete;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onPointCountChangeRef = useRef(onPointCountChange);
  onPointCountChangeRef.current = onPointCountChange;

  const snapCoordsRef = useRef(snapCoords);
  snapCoordsRef.current = snapCoords;

  const allowedBoundaryRef = useRef(allowedBoundary);
  allowedBoundaryRef.current = allowedBoundary;

  const onInvalidPointRef = useRef(onInvalidPoint);
  onInvalidPointRef.current = onInvalidPoint;

  useEffect(() => {
    if (!mode) return;
    map.closePopup();
    pointsRef.current = [];
    onPointCountChangeRef.current?.(0);

    const lg = L.layerGroup().addTo(map);
    lgRef.current = lg;
    map.getContainer().classList.add("catchment-polygon-drawing");
    map.getContainer().style.cursor = "crosshair";
    const color = mode === "catchment" ? "#1a56db" : "#e67e22";

    const snapMarker = L.circleMarker([0, 0], {
      radius: 6,
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.85,
      weight: 2,
      interactive: false,
    });
    snapMarkerRef.current = snapMarker;

    const redraw = () => {
      lg.clearLayers();
      const pts = pointsRef.current;
      if (pts.length > 1) {
        L.polyline([...pts, pts[0]], { color, weight: 2.5, dashArray: "6,4", opacity: 0.85, interactive: false }).addTo(lg);
      }
      pts.forEach((pt) =>
        L.circleMarker(pt, { radius: 5, color: "#fff", fillColor: color, fillOpacity: 1, weight: 2, interactive: false }).addTo(lg)
      );
    };

    const finishDrawing = () => {
      const pts = pointsRef.current;
      if (pts.length < 3) return;
      lg.clearLayers();
      L.polygon(pts, { color, fillOpacity: 0.18, weight: 3, interactive: false }).addTo(lg);
      onPolygonCompleteRef.current([...pts]);
      cleanup();
    };

    if (finishTriggerRef) {
      finishTriggerRef.current = finishDrawing;
    }

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      const currentSnap = snapCoordsRef.current;
      if (!currentSnap || currentSnap.length === 0) return;
      const snapped = findSnapPoint(e.latlng.lat, e.latlng.lng, currentSnap, map, 18);
      const isSnapped = snapped[0] !== e.latlng.lat || snapped[1] !== e.latlng.lng;
      if (isSnapped) {
        snapMarker.setLatLng(snapped);
        if (!lg.hasLayer(snapMarker)) snapMarker.addTo(lg);
      } else {
        if (lg.hasLayer(snapMarker)) lg.removeLayer(snapMarker);
      }
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      const currentSnap = snapCoordsRef.current;
      const snapped = findSnapPoint(e.latlng.lat, e.latlng.lng, currentSnap, map, 18);
      const boundary = allowedBoundaryRef.current;
      if (mode === "community" && boundary && boundary.length >= 3) {
        try {
          const inside = turf.booleanPointInPolygon(
            turf.point([snapped[1], snapped[0]]),
            turf.polygon([toGeoRing(boundary)]),
            { ignoreBoundary: false },
          );
          if (!inside) {
            onInvalidPointRef.current?.();
            return;
          }
        } catch {
          onInvalidPointRef.current?.();
          return;
        }
      }
      pointsRef.current = [...pointsRef.current, snapped];
      onPointCountChangeRef.current?.(pointsRef.current.length);
      redraw();
    };

    const onDblClick = () => {
      finishDrawing();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { 
        onCloseRef.current(); 
        cleanup(); 
      }
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (pointsRef.current.length > 0) {
          pointsRef.current = pointsRef.current.slice(0, -1);
          onPointCountChangeRef.current?.(pointsRef.current.length);
          redraw();
        }
      }
    };

    const cleanup = () => {
      map.off("click", onClick);
      map.off("mousemove", onMouseMove);
      map.off("dblclick", onDblClick);
      document.removeEventListener("keydown", onKey);
      map.getContainer().classList.remove("catchment-polygon-drawing");
      map.getContainer().style.cursor = "";
      if (finishTriggerRef) finishTriggerRef.current = null;
      onPointCountChangeRef.current?.(0);
    };

    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.on("dblclick", onDblClick);
    document.addEventListener("keydown", onKey);

    return () => {
      cleanup();
      if (lgRef.current) { 
        map.removeLayer(lgRef.current); 
        lgRef.current = null; 
      }
    };
  }, [mode, map, finishTriggerRef]);

  return null;
}

function VertexEditor({
  coords,
  color,
  onChange,
}: {
  coords: [number, number][];
  color: string;
  onChange: (coords: [number, number][]) => void;
}) {
  const icon = L.divIcon({
    className: "",
    html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:' + color + ';border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.45)"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  return (
    <>
      {coords.map((position, index) => (
        <Marker
          key={"vertex-" + index}
          position={position}
          icon={icon}
          draggable
          eventHandlers={{
            drag: (event: any) => {
              const point = event.target.getLatLng();
              onChange(coords.map((coord, coordIndex) => coordIndex === index ? [point.lat, point.lng] : coord));
            },
          }}
        />
      ))}
    </>
  );
}

// --- Fit map to polygon after draw -------------------------------------------
function FitToPolygon({ coords }: { coords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 3) return;
    map.fitBounds(L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng))), { padding: [40, 40] });
  }, [coords, map]);
  return null;
}

// --- Geolocation button -------------------------------------------------------
function GeolocateButton() {
  const map = useMap();
  return (
    <button
      type="button"
      title="Go to my location"
      onClick={() =>
        navigator.geolocation?.getCurrentPosition((pos) =>
          map.setView([pos.coords.latitude, pos.coords.longitude], 15)
        )
      }
      className="absolute bottom-14 right-2 z-[1000] flex h-8 w-8 items-center justify-center rounded bg-white shadow border text-base hover:bg-gray-50"
    >
      <Compass className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// --- Main component -----------------------------------------------------------
export function CatchmentMapPanel({
  facilityId,
  facilityName,
  facilityLat = -6.314,
  facilityLng = 143.956,
  communities,
  onCommunityPopUpdate,
  onExtractedCommunities,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canCreatePolygon = hasAnyPermission(user, ["polygon.create", "manage_boundaries"]);
  const canEditPolygon = hasAnyPermission(user, ["polygon.edit", "manage_boundaries"]);
  const canReplacePolygon = hasAnyPermission(user, ["polygon.replace", "manage_boundaries"]);
  const canViewHistory = hasAnyPermission(user, ["polygon.view_history", "manage_boundaries"]);
  const canApprovePolygon = hasAnyPermission(user, ["polygon.approve"]);
  const canDeleteDraft = hasAnyPermission(user, ["polygon.delete_draft", "manage_boundaries"]);
  const canArchivePolygon = hasAnyPermission(user, ["polygon.archive", "manage_boundaries"]);
  const canRecalculatePopulation = hasAnyPermission(user, ["polygon.recalculate_population", "manage_boundaries"]);

  const userRole = (user?.role || "").toLowerCase();
  const userRoles: string[] = Array.isArray(user?.roles) ? user?.roles.map((r: any) => String(r).toLowerCase()) : [];
  const allowedAdminManagerRoles = ["platform_admin", "national_admin", "national_manager", "gis_specialist", "provincial_coordinator", "district_manager", "admin", "manager"];
  const isNationalAdminOrManager = allowedAdminManagerRoles.includes(userRole) || userRoles.some(r => allowedAdminManagerRoles.includes(r));
  const canDeleteActivePolygon = isNationalAdminOrManager || hasAnyPermission(user, ["polygon.delete", "polygon.archive", "manage_boundaries"]);

  const [deletingFacilityCatchment, setDeletingFacilityCatchment] = useState(false);
  const [deletingCommunityId, setDeletingCommunityId] = useState<number | null>(null);

  const [catchment, setCatchment] = useState<CatchmentPolygon | null>(null);
  const [communityPolygons, setCommunityPolygons] = useState<CommunityPolygon[]>([]);
  const [drawMode, setDrawMode] = useState<"catchment" | "community" | null>(null);
  const [activeVertexCount, setActiveVertexCount] = useState(0);
  const finishTriggerRef = useRef<(() => void) | null>(null);

  const [selectedCommunity, setSelectedCommunity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingPop, setLoadingPop] = useState(false);
  const [basemap, setBasemap] = usePersistedBasemap("positron");
  const [fitCoords, setFitCoords] = useState<[number, number][] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractBufferKm, setExtractBufferKm] = useState<number>(0.5);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [showGap, setShowGap] = useState(true);
  const [intelligenceData, setIntelligenceData] = useState<IntelligenceResult | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const catchingRef = useRef(false);

  const [lifecycleEdit, setLifecycleEdit] = useState<LifecycleEntity | null>(null);
  const [lifecycleValidation, setLifecycleValidation] = useState<LifecycleValidation | null>(null);
  const [validationBusy, setValidationBusy] = useState(false);
  const [pendingVersion, setPendingVersion] = useState<LifecycleVersion | null>(null);
  const [historyOwner, setHistoryOwner] = useState<{ entityType: "facility" | "village"; entityId: number; name: string } | null>(null);
  const [historyRows, setHistoryRows] = useState<LifecycleVersion[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [comparison, setComparison] = useState<any | null>(null);

  // Missed communities analysis state
  const [missedAnalysis, setMissedAnalysis] = useState<any | null>(null);
  const [loadingMissed, setLoadingMissed] = useState(false);
  const [autoClipping, setAutoClipping] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showCommunityPins, setShowCommunityPins] = useState(true);

  const effectiveCommunities = useMemo(() => {
    return communities.filter((c) => !(c.villageId && c.villageId >= 253111 && c.villageId <= 253118));
  }, [communities]);

  const selectedCommunityRecord = useMemo(() => {
    return effectiveCommunities.find((c) => c.name === selectedCommunity);
  }, [effectiveCommunities, selectedCommunity]);

  const selectedCommunityPolygon = useMemo(() => {
    return communityPolygons.find((p) => p.communityName === selectedCommunity);
  }, [communityPolygons, selectedCommunity]);

  // --- Distinct Pin Icons for Health Facility & Communities -----------------
  const facilityPinIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-hf-pin",
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor:pointer;">
          <div style="background-color:#1e40af; color:white; font-size:13px; font-weight:bold; width:28px; height:28px; border-radius:50%; border:2.5px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.4);">
            🏥
          </div>
          <div style="background:#1e3a8a; color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; margin-top:2px; white-space:nowrap; border:1px solid rgba(255,255,255,0.3); box-shadow:0 2px 4px rgba(0,0,0,0.3);">
            ${facilityName}
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -32],
    });
  }, [facilityName]);

  const communityPinIcon = useCallback((name: string, isSelected: boolean, isMapped: boolean) => {
    const color = isSelected ? "#8b5cf6" : isMapped ? "#10b981" : "#f59e0b";
    const ringStyle = isSelected ? "box-shadow: 0 0 0 3px #c4b5fd, 0 3px 8px rgba(0,0,0,0.4);" : "box-shadow: 0 2px 6px rgba(0,0,0,0.35);";
    const badgeSymbol = isSelected ? "🎯" : isMapped ? "✓" : "📍";
    return L.divIcon({
      className: "custom-comm-pin",
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor:pointer;">
          <div style="background-color:${color}; color:white; font-size:11px; font-weight:bold; width:22px; height:22px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; ${ringStyle}">
            ${badgeSymbol}
          </div>
          <div style="background:rgba(15,23,42,0.85); color:#fff; font-size:10px; font-weight:600; padding:1px 5px; border-radius:4px; margin-top:2px; white-space:nowrap; border:1px solid rgba(255,255,255,0.2); box-shadow:0 1px 3px rgba(0,0,0,0.2);">
            ${name}
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -28],
    });
  }, []);

  // --- Load existing polygons on mount ---------------------------------------
  useEffect(() => {
    if (!facilityId) return;
    apiRequest<any>("GET", `/api/facilities/${facilityId}/catchment-polygon`)
      .then((r) => {
        const display = r?.catchmentPolygon ? r : { ...r, ...(r?.draftPolygonDetails || {}), catchmentPolygon: r?.draftPolygon };
        const coords = coordsFromGeoJson(display?.catchmentPolygon);
        if (coords) {
          const meta = metaFromResponse(display);
          setCatchment({
            coords,
            gridPopulation: display.catchmentGridPopulation ?? display.populationEstimate ?? meta.populationEstimate ?? undefined,
            under5Population: meta.underFive ?? undefined,
            locked: true,
            ...meta,
          });
          if (!r?.catchmentPolygon && r?.draftPolygonDetails) {
            setPendingVersion(r.draftPolygonDetails);
            setHistoryOwner({ entityType: "facility", entityId: facilityId, name: facilityName });
          }
        }
      }).catch(() => {});

    effectiveCommunities.forEach((c) => {
      if (!c.villageId) return;
      apiRequest<any>("GET", `/api/villages/${c.villageId}/community-polygon`)
        .then((r) => {
          const display = r?.catchmentPolygon ? r : { ...r, ...(r?.draftPolygonDetails || {}), catchmentPolygon: r?.draftPolygon };
          const coords = coordsFromGeoJson(display?.catchmentPolygon);
          if (coords) {
            const meta = metaFromResponse(display);
            if (meta.areaSqKm && meta.areaSqKm > 100) return; // Prevent full district administrative shapefiles from rendering as community polygons
            setCommunityPolygons((prev) => {
              if (prev.some((p) => p.communityName === c.name)) return prev;
              return [...prev, {
                communityName: c.name,
                communityId: c.villageId,
                color: r.polygonColor || PALETTE[prev.length % PALETTE.length],
                coords,
                griddedPopulation: display.griddedPopulation ?? display.populationEstimate ?? meta.populationEstimate ?? undefined,
                under5Population: meta.underFive ?? undefined,
                saved: true,
                ...meta,
              }];
            });
            if (!r?.catchmentPolygon && r?.draftPolygonDetails) {
              setPendingVersion(r.draftPolygonDetails);
              setHistoryOwner({ entityType: "village", entityId: c.villageId!, name: c.name });
            }
          }
        }).catch(() => {});
    });
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMissedCommunities = useCallback(async () => {
    if (!facilityId) return;
    setLoadingMissed(true);
    try {
      const data = await apiRequest<any>("GET", `/api/facilities/${facilityId}/missed-communities`);
      setMissedAnalysis(data);
    } catch {
      // Keep previous or null
    } finally {
      setLoadingMissed(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchMissedCommunities();
  }, [fetchMissedCommunities, communityPolygons.length, catchment?.coords]);

  const snapCoords = useMemo(() => {
    const coords: [number, number][] = [];
    if (catchment?.coords) coords.push(...catchment.coords);
    for (const poly of communityPolygons) {
      if (poly.communityName !== selectedCommunity && poly.coords) {
        coords.push(...poly.coords);
      }
    }
    // Include community pin locations for magnetic vertex referencing!
    for (const com of communities) {
      if (com.latitude != null && com.longitude != null && !isNaN(com.latitude) && !isNaN(com.longitude)) {
        coords.push([com.latitude, com.longitude]);
      }
    }
    return coords;
  }, [catchment, communityPolygons, selectedCommunity, communities]);

  // --- Overlap check ----------------------------------------------------------
  const hasOverlap = useCallback((newCoords: [number, number][]): boolean => {
    try {
      const ring = toGeoRing(newCoords);
      if (ring.length < 4) return false;
      const newPoly = turf.polygon([ring]);
      return communityPolygons.some((existing) => {
        if (existing.communityName === selectedCommunity || !existing.coords || existing.coords.length < 3) return false;
        try {
          const exRing = toGeoRing(existing.coords);
          if (exRing.length < 4) return false;
          return turf.intersect(turf.featureCollection([newPoly, turf.polygon([exRing])])) !== null;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }, [communityPolygons, selectedCommunity]);

  // --- Auto-Clip Overlapping Community ----------------------------------------
  const handleAutoClip = async () => {
    const targetVillageId = selectedCommunityRecord?.villageId;
    if (!targetVillageId || !selectedCommunityPolygon) return;
    setAutoClipping(true);
    try {
      const res = await apiRequest<any>("POST", `/api/polygons/village/${targetVillageId}/auto-clip`, {
        geometry: { type: "Polygon", coordinates: [toGeoRing(selectedCommunityPolygon.coords)] }
      });
      if (res.clippedGeometry) {
        const coords = coordsFromGeoJson(res.clippedGeometry);
        if (coords) {
          setCommunityPolygons((rows) => rows.map((p) => p.communityId === targetVillageId ? {
            ...p,
            coords,
            saved: false,
            ...localPolygonMeta(coords, facilityLat, facilityLng),
          } : p));
          toast({
            title: "Boundary Auto-Clipped",
            description: `Trimmed ${res.removedAreaSqKm.toFixed(2)} km² of overlap against ${res.clippedBySiblingsCount} neighboring boundaries with zero overlap.`,
          });
        }
      } else {
        toast({ title: "Auto-clip notice", description: "This boundary is completely covered by existing neighbors.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Auto-clip failed", description: err?.message, variant: "destructive" });
    } finally {
      setAutoClipping(false);
    }
  };

  // --- Handle completed polygon -----------------------------------------------
  const handlePolygonComplete = useCallback(async (rawCoords: [number, number][]) => {
    // Filter out duplicate consecutive points
    const coords = rawCoords.filter((pt, idx, arr) => {
      if (idx === 0) return true;
      const prev = arr[idx - 1];
      return Math.abs(pt[0] - prev[0]) > 1e-6 || Math.abs(pt[1] - prev[1]) > 1e-6;
    });

    if (coords.length < 3) {
      toast({ title: "Invalid shape", description: "A polygon requires at least 3 distinct vertices.", variant: "destructive" });
      setDrawMode(null);
      return;
    }

    const mode = drawMode;
    setDrawMode(null);

    const type = mode === "catchment" ? "facility" : "village";
    const village = communities.find((community) => community.name === selectedCommunity);
    const ownerId = mode === "catchment" ? facilityId : village?.villageId;

    setLoadingPop(true);
    const intel = await estimatePolygonPop(coords, type, ownerId);
    setLoadingPop(false);
    
    if (intel) setIntelligenceData(intel);
    const total = intel?.sources[0]?.totalPopulation || 0;
    const under5 = intel?.sources[0]?.under5Population || 0;
    const localMeta = localPolygonMeta(coords, facilityLat, facilityLng);

    if (mode === "catchment") {
      setCatchment({
        coords,
        gridPopulation: total || undefined,
        under5Population: under5 || undefined,
        populationEstimate: total || undefined,
        underFive: under5 || undefined,
        locked: false,
        ...localMeta,
      });
      setFitCoords(coords);
      toast({
        title: "HF Catchment boundary drawn",
        description: total
          ? `Estimated ~${total.toLocaleString()} population (${under5.toLocaleString()} U5). Click "Save & Lock" to lock and enable community drawing.`
          : "Boundary drawn. Click 'Save & Lock' to persist.",
      });
      return;
    }

    if (!selectedCommunity) {
      toast({ title: "No community selected", description: "Select a community from the dropdown before drawing its boundary.", variant: "destructive" });
      return;
    }

    if (hasOverlap(coords)) {
      toast({
        title: "Boundary Overlap Detected",
        description: "This community polygon intersects an adjacent community. Click '⚡ Auto-Clip to Free Space' to trim the overlap automatically.",
        variant: "destructive",
      });
    }

    const existingIndex = communityPolygons.findIndex((polygon) => polygon.communityName === selectedCommunity);
    const color = existingIndex >= 0 ? communityPolygons[existingIndex].color : PALETTE[communityPolygons.length % PALETTE.length];
    const entry: CommunityPolygon = {
      communityName: selectedCommunity,
      communityId: village?.villageId,
      color,
      coords,
      griddedPopulation: total || undefined,
      under5Population: under5 || undefined,
      populationEstimate: total || undefined,
      underFive: under5 || undefined,
      saved: false,
      ...localMeta,
    };

    setCommunityPolygons((previous) =>
      existingIndex >= 0 ? previous.map((polygon, index) => index === existingIndex ? entry : polygon) : [...previous, entry],
    );
    if (total) onCommunityPopUpdate(selectedCommunity, total);
    toast({
      title: `"${selectedCommunity}" boundary drawn`,
      description: total
        ? `~${total.toLocaleString()} people estimated. Click "Save Community" or "Save All" to persist.`
        : "Boundary drawn. Click Save to persist.",
    });
  }, [drawMode, selectedCommunity, catchment, communityPolygons, hasOverlap, onCommunityPopUpdate, toast, facilityId, facilityLat, facilityLng, communities]);

  // --- Save HF Catchment -------------------------------------------------------
  const saveCatchment = async () => {
    if (!catchment || catchingRef.current) return;
    catchingRef.current = true;
    setSaving(true);
    try {
      const geojson = { type: "Polygon", coordinates: [toGeoRing(catchment.coords)] };
      const res = await apiRequest<any>("PATCH", `/api/facilities/${facilityId}/catchment-polygon`, {
        geojson,
        gridPopulation: catchment.gridPopulation || catchment.populationEstimate || 0,
        status: "active",
      });

      const meta = metaFromResponse(res);
      setCatchment((polygon) => polygon ? {
        ...polygon,
        locked: true,
        gridPopulation: res.catchmentGridPopulation ?? res.populationEstimate ?? polygon.gridPopulation,
        under5Population: res.population?.underFive ?? polygon.under5Population,
        ...meta,
      } : polygon);

      // Invalidate relevant query keys so all maps and summaries sync
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/catchment-polygon`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons/viewport"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/missed-communities`] });

      toast({
        title: "HF Catchment boundary saved & locked",
        description: `Catchment area (${(res.areaSqKm ?? catchment.areaSqKm ?? 0).toFixed?.(2) ?? "?"} km²) with ~${(res.catchmentGridPopulation ?? catchment.gridPopulation ?? 0).toLocaleString()} population is active.`,
      });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Failed to save catchment", variant: "destructive" });
    } finally {
      setSaving(false);
      catchingRef.current = false;
    }
  };

  // --- Save Community Polygon -------------------------------------------------
  const saveCommunity = async (polygon: CommunityPolygon) => {
    const community = communities.find((item) => item.name === polygon.communityName);
    if (!community?.villageId) {
      toast({ title: "Community Record Missing", description: "Save the community name in the Communities tab first.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const geojson = { type: "Polygon", coordinates: [toGeoRing(polygon.coords)] };
      const res = await apiRequest<any>("PATCH", `/api/villages/${community.villageId}/community-polygon`, {
        geojson,
        griddedPopulation: polygon.griddedPopulation || polygon.populationEstimate || 0,
        polygonColor: polygon.color,
        status: "active",
      });

      const meta = metaFromResponse(res);
      setCommunityPolygons((previous) => previous.map((item) => item.communityName === polygon.communityName ? {
        ...item,
        saved: true,
        griddedPopulation: res.griddedPopulation ?? res.populationEstimate ?? item.griddedPopulation,
        under5Population: res.under5Population ?? item.under5Population,
        ...meta,
      } : item));

      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      queryClient.invalidateQueries({ queryKey: [`/api/villages/${community.villageId}/community-polygon`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons/viewport"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/missed-communities`] });

      toast({
        title: `"${polygon.communityName}" boundary saved`,
        description: `Community sub-polygon saved (~${(res.griddedPopulation ?? polygon.griddedPopulation ?? 0).toLocaleString()} population).`,
      });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Failed to save community polygon", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Save all ----------------------------------------------------------------
  const saveAll = async () => {
    let count = 0;
    if (catchment && !catchment.locked) {
      await saveCatchment();
      count++;
    }
    const unsaved = communityPolygons.filter((p) => !p.saved);
    for (const poly of unsaved) {
      await saveCommunity(poly);
      count++;
    }
    if (count === 0) {
      toast({ title: "All polygons saved", description: "All facility and community polygons are already up to date and saved." });
    }
  };

  // --- Auto-suggest Catchment (Convex Hull) -----------------------------------
  const autoSuggestCatchment = async () => {
    setSuggesting(true);
    try {
      const result = await apiRequest<any>("POST", "/api/gis/polygons/suggest", { facilityId });
      const geom = result?.geometry || result;
      if (geom && geom.coordinates) {
        let coords: [number, number][];
        if (geom.type === "Polygon") {
          coords = geom.coordinates[0].map(([lng, lat]: number[]) => [lat, lng]);
        } else if (geom.type === "MultiPolygon") {
          coords = geom.coordinates[0][0].map(([lng, lat]: number[]) => [lat, lng]);
        } else {
          throw new Error("Invalid geometry type");
        }
        await handlePolygonComplete(coords);
      } else {
        toast({ title: "Suggest failed", description: "No geometry returned", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Auto-suggest failed", description: e?.message || "Not enough data points.", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  // --- Delete Polygons --------------------------------------------------------
  const handleDeleteFacilityCatchment = async () => {
    if (!facilityId) return;
    const confirmed = window.confirm(`Are you sure you want to delete the facility catchment polygon for ${facilityName}? This will reset the catchment boundary.`);
    if (!confirmed) return;

    setDeletingFacilityCatchment(true);
    try {
      await apiRequest("DELETE", `/api/facilities/${facilityId}/catchment-polygon`);
      setCatchment(null);
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/catchment-polygon`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/missed-communities`] });
      toast({ title: "Catchment polygon deleted", description: `The facility catchment polygon for ${facilityName} has been reset.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Failed to delete catchment polygon", variant: "destructive" });
    } finally {
      setDeletingFacilityCatchment(false);
    }
  };

  const handleDeleteCommunityPolygon = async (villageId: number) => {
    const communityName = selectedCommunity || "this community";
    const confirmed = window.confirm(`Are you sure you want to delete the community polygon for ${communityName}?`);
    if (!confirmed) return;

    setDeletingCommunityId(villageId);
    try {
      await apiRequest("DELETE", `/api/villages/${villageId}/community-polygon`);
      setCommunityPolygons((prev) => prev.filter((p) => p.communityId !== villageId && p.communityName !== communityName));
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      queryClient.invalidateQueries({ queryKey: [`/api/villages/${villageId}/community-polygon`] });
      queryClient.invalidateQueries({ queryKey: ["/api/gis/polygons"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/missed-communities`] });
      toast({ title: "Community polygon deleted", description: `The community polygon for ${communityName} has been removed.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Failed to delete community polygon", variant: "destructive" });
    } finally {
      setDeletingCommunityId(null);
    }
  };

  // --- Extract communities (aggressive OSM scraping) --------------------------
  const extractCommunities = async () => {
    if (!catchment) { toast({ title: "Draw catchment first", variant: "destructive" }); return; }
    setExtracting(true);
    try {
      const result = await apiRequest<ExtractResult>("POST", "/api/catchments/extract", {
        geojson: { type: "Polygon", coordinates: [toGeoRing(catchment.coords)] },
        bufferKm: extractBufferKm,
        bufferMeters: Math.round(extractBufferKm * 1000),
        includeOsm: true,
      });
      setExtractResult(result);
      const total = result.counts.villages + result.counts.settlements + result.counts.unmapped;
      toast({
        title: `${total} community places extracted`,
        description: `${result.counts.villages} registered - ${result.counts.settlements} settlements - ${result.counts.unmapped} OSM places (Buffer: ${extractBufferKm}km)`,
      });
      if (onExtractedCommunities) {
        onExtractedCommunities([
          ...result.villages.map((v) => v.name),
          ...result.settlements.map((s) => s.name),
          ...result.unmapped.map((u) => u.name),
        ]);
      }
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e?.message, variant: "destructive" });
    } finally { setExtracting(false); }
  };

  // --- Flag uncovered communities to district ---------------------------------
  const uncovered = communities.filter((c) => !communityPolygons.some((p) => p.communityName === c.name));
  const flagUncovered = async () => {
    if (!uncovered.length) return;
    try {
      await apiRequest("POST", `/api/facilities/${facilityId}/flag-uncovered`, {
        communities: uncovered.map((c) => ({ villageName: c.name, villageId: c.villageId, estimatedPopulation: parseInt(c.targetPopulation || "0", 10) })),
        flaggedLevel: "district",
      });
      toast({ title: "Gaps flagged", description: `${uncovered.length} communities reported to district officials.` });
    } catch (e: any) { toast({ title: "Flag failed", description: e?.message, variant: "destructive" }); }
  };

  // --- Population balance ------------------------------------------------------
  const rawCommunityPopSum = communityPolygons.reduce((s, p) => s + (p.griddedPopulation ?? 0), 0);
  const catchmentPop = catchment?.gridPopulation ?? 0;
  const populationScale = catchmentPop > 0 && rawCommunityPopSum > catchmentPop
    ? catchmentPop / rawCommunityPopSum
    : 1;
  const communityPopSum = Math.round(rawCommunityPopSum * populationScale);
  const isPopulationOverAllocated = catchmentPop > 0 && rawCommunityPopSum > catchmentPop;
  const rawBalancePct = catchmentPop > 0 ? Math.round((rawCommunityPopSum / catchmentPop) * 100) : 0;
  const balancePct = catchmentPop > 0 ? Math.min(100, Math.round((communityPopSum / catchmentPop) * 100)) : 0;
  const displayCommunityPopulation = (polygon?: CommunityPolygon) =>
    polygon?.griddedPopulation
      ? Math.round(polygon.griddedPopulation * populationScale)
      : 0;

  const center: [number, number] = [facilityLat, facilityLng];

  // --- Gap polygon = catchment minus union of community polygons --------------
  const gapPolygons: [number, number][][] = (() => {
    if (!catchment || !showGap || communityPolygons.length === 0) return [];
    try {
      const ring = toGeoRing(catchment.coords);
      if (ring.length < 4) return [];
      const catchPoly = turf.polygon([ring]);
      const comFeatures = communityPolygons
        .filter((p) => p.coords && p.coords.length >= 3)
        .map((p) => {
          const cRing = toGeoRing(p.coords);
          return cRing.length >= 4 ? turf.polygon([cRing]) : null;
        })
        .filter(Boolean) as GeoJSONFeature<GeoJSONPolygon>[];
      if (comFeatures.length === 0) return [];
      let union: GeoJSONFeature<GeoJSONPolygon | GeoJSONMultiPolygon> | null = comFeatures[0];

      for (let i = 1; i < comFeatures.length; i++) {
        union = union ? turf.union(turf.featureCollection([union as any, comFeatures[i]])) : comFeatures[i];
      }
      if (!union) return [];
      const gap = turf.difference(turf.featureCollection([catchPoly as any, union as any]));
      if (!gap) return [];
      const geom = gap.geometry;
      if (geom.type === "Polygon") {
        return [geom.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])];
      } else if (geom.type === "MultiPolygon") {
        return geom.coordinates.map((poly) => poly[0].map(([lng, lat]) => [lat, lng] as [number, number]));
      }
    } catch { return []; }
    return [];
  })();

  return (
    <div className="flex flex-col gap-3">

      {/* ── Guided Progress Step Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border bg-gradient-to-r from-blue-50/80 via-slate-50 to-orange-50/80 dark:from-blue-950/30 dark:via-slate-900/40 dark:to-orange-950/30 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Step 1 Pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            catchment
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40"
          }`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              catchment ? "bg-emerald-600 text-white" : "bg-white text-blue-700 font-extrabold"
            }`}>
              {catchment ? "✓" : "1"}
            </span>
            <span>Step 1: HF Catchment</span>
            {catchment && <span className="text-[10px] opacity-80">(Established)</span>}
          </div>

          <span className="text-muted-foreground font-bold text-xs">→</span>

          {/* Step 2 Pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            !catchment
              ? "opacity-60 bg-muted/60 border-border text-muted-foreground"
              : communityPolygons.length === communities.length && communities.length > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-orange-600 text-white shadow-sm ring-2 ring-orange-400/40"
          }`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              communityPolygons.length === communities.length && communities.length > 0
                ? "bg-emerald-600 text-white"
                : !catchment
                  ? "bg-muted-foreground/30 text-muted-foreground"
                  : "bg-white text-orange-700 font-extrabold"
            }`}>
              {communityPolygons.length === communities.length && communities.length > 0 ? "✓" : "2"}
            </span>
            <span>Step 2: Community Sub-Polygons</span>
            <span className="text-[10px] opacity-80">
              ({communityPolygons.length}/{communities.length})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Workflow Guide</span>
          </button>
        </div>
      </div>

      {/* ── Toolbar: Step 1 & Step 2 Controls ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card p-3 text-sm shadow-xs">
        
        {/* Step 1: Catchment Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            HF Catchment:
          </span>

          {!catchment ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!!drawMode || !canCreatePolygon}
                onClick={() => setDrawMode("catchment")}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-xs ring-2 ring-blue-500/20"
              >
                <span>✏️ Draw HF Catchment</span>
              </button>
              <button
                type="button"
                onClick={autoSuggestCatchment}
                disabled={suggesting || !!drawMode}
                className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1"
                title="Automatically generate catchment perimeter from existing village settlement points"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{suggesting ? "Generating..." : "Auto-Suggest"}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold flex items-center gap-1 ${
                catchment.locked ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              }`}>
                {catchment.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                {catchment.locked ? "Locked Active" : "Draft (Unsaved)"}
              </span>

              {catchment.gridPopulation != null && (
                <span className="text-xs font-medium text-muted-foreground">
                  ~{catchment.gridPopulation.toLocaleString()} pop
                  {catchment.areaSqKm ? ` • ${catchment.areaSqKm.toFixed(1)} km²` : ""}
                </span>
              )}

              {!catchment.locked && (
                <button
                  type="button"
                  onClick={saveCatchment}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{saving ? "Saving..." : "Save & Lock Catchment"}</span>
                </button>
              )}

              {catchment.locked && (
                <>
                  <button
                    type="button"
                    onClick={() => setFitCoords(catchment.coords)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Fit Map
                  </button>
                  {canDeleteActivePolygon && (
                    <button
                      type="button"
                      onClick={handleDeleteFacilityCatchment}
                      disabled={deletingFacilityCatchment}
                      className="rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>{deletingFacilityCatchment ? "..." : "Reset"}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

        {/* Step 2: Community Sub-Polygons Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300 flex items-center gap-1">
            <Crosshair className="h-3.5 w-3.5" />
            Communities:
          </span>

          {!catchment ? (
            <span className="text-xs text-muted-foreground italic flex items-center gap-1">
              <Lock className="h-3 w-3 text-muted-foreground" />
              Draw HF Catchment first to unlock community mapping
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-[150px] max-w-[210px] rounded-lg border px-2.5 py-1.5 text-xs font-medium bg-background"
                value={selectedCommunity}
                onChange={(e) => setSelectedCommunity(e.target.value)}
              >
                <option value="">-- Select Community --</option>
                {communities.map((c) => {
                  const isMapped = communityPolygons.some((p) => p.communityName === c.name);
                  return (
                    <option key={c.name} value={c.name}>
                      {isMapped ? "🟢 " : "🔴 "} {c.name} {isMapped ? "(Mapped)" : "(Pending)"}
                    </option>
                  );
                })}
              </select>

              {!selectedCommunityPolygon ? (
                <button
                  type="button"
                  disabled={!selectedCommunity || !!drawMode || !canCreatePolygon}
                  onClick={() => setDrawMode("community")}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                >
                  <span>✏️ Draw Polygon</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {!selectedCommunityPolygon.saved && (
                    <>
                      <button
                        type="button"
                        onClick={() => saveCommunity(selectedCommunityPolygon)}
                        disabled={saving}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAutoClip}
                        disabled={autoClipping}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                        title="Automatically trim overlapping segments against neighboring boundaries"
                      >
                        <Scissors className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{autoClipping ? "Clipping..." : "⚡ Auto-Clip"}</span>
                      </button>
                    </>
                  )}

                  {selectedCommunityRecord?.villageId && canDeleteActivePolygon && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCommunityPolygon(selectedCommunityRecord.villageId!)}
                      disabled={deletingCommunityId === selectedCommunityRecord.villageId}
                      className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-2 py-1.5 text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                      title="Delete community polygon"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {catchment && (
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{saving ? "Saving All..." : "Save All"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Active Drawing Banner & Quick Actions ── */}
      {drawMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-300 bg-blue-50/90 dark:bg-blue-950/40 p-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs animate-pulse">
              ✏️
            </span>
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-200">
                Drawing {drawMode === "catchment" ? `HF Catchment for ${facilityName}` : `Community Boundary: ${selectedCommunity}`}
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Click map to place points • 🟢 Green marker snaps to borders • Double-click or click "Finish Shape" when done ({activeVertexCount} vertices placed)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeVertexCount >= 3 && (
              <button
                type="button"
                onClick={() => finishTriggerRef.current?.()}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 animate-bounce"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Finish Shape ({activeVertexCount} pts)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDrawMode(null)}
              className="rounded-lg border border-blue-200 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-blue-800 dark:text-blue-200 hover:bg-blue-100"
            >
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}

      {loadingPop && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 animate-pulse flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span>Extracting gridded population from local GeoTIFF & WorldPop cascade...</span>
        </div>
      )}

      {/* ── Interactive Map Container ── */}
      <div className="relative h-[440px] w-full overflow-hidden rounded-xl border shadow-sm sm:h-[520px]">
        <style>{`.catchment-polygon-drawing .leaflet-interactive { pointer-events: none !important; }`}</style>
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} doubleClickZoom={false}>
          <BasemapTileLayer basemap={basemap} />

          {/* HF Catchment Polygon */}
          {catchment && catchment.coords && catchment.coords.length >= 3 && (
            <Polygon
              positions={catchment.coords}
              interactive={!drawMode}
              pathOptions={{
                color: catchment.locked ? "#1a56db" : "#3b82f6",
                fillColor: "#1a56db",
                fillOpacity: catchment.locked ? 0.08 : 0.04,
                weight: catchment.locked ? 3 : 2.5,
                dashArray: catchment.locked ? undefined : "6,4",
              }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <strong className="text-blue-700 font-bold">{facilityName} - HF Catchment</strong>
                  <p className="text-muted-foreground">Grid Population: ~{(catchment.gridPopulation ?? 0).toLocaleString()}</p>
                  <p className="text-muted-foreground">Under-5 Infants: ~{(catchment.under5Population ?? 0).toLocaleString()}</p>
                  <p className="text-muted-foreground">Area: {(catchment.areaSqKm ?? 0).toFixed(2)} km²</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${catchment.locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {catchment.locked ? "✓ Active & Locked" : "⚠️ Unsaved Draft"}
                  </span>
                </div>
              </Popup>
            </Polygon>
          )}

          {/* Community Polygons */}
          {communityPolygons.map((poly) => (
            poly.coords && poly.coords.length >= 3 && (
              <Polygon
                key={poly.communityName}
                positions={poly.coords}
                interactive={!drawMode}
                pathOptions={{
                  color: poly.color,
                  fillColor: poly.color,
                  fillOpacity: poly.communityName === selectedCommunity ? 0.32 : 0.18,
                  weight: poly.communityName === selectedCommunity ? 3.5 : 2,
                  dashArray: poly.saved ? undefined : "6,4",
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong style={{ color: poly.color }}>{poly.communityName}</strong>
                    <p className="text-muted-foreground">Population: ~{(poly.griddedPopulation ?? 0).toLocaleString()}</p>
                    <p className="text-muted-foreground">Under-5: ~{(poly.under5Population ?? 0).toLocaleString()}</p>
                    <p className="text-muted-foreground">Area: {(poly.areaSqKm ?? 0).toFixed(2)} km²</p>
                    {poly.saved ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Saved & Active
                      </span>
                    ) : (
                      <div className="pt-1">
                        <button
                          onClick={() => saveCommunity(poly)}
                          disabled={saving}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                        >
                          Save Boundary
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>
            )
          ))}

          {/* Coverage Gap Overlays (Red hatched area) */}
          {showGap && gapPolygons.map((ring, i) => (
            <Polygon
              key={`gap-${i}`}
              positions={ring}
              interactive={!drawMode}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.16, weight: 1.5, dashArray: "5,4" }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <strong className="text-red-600 font-bold">⚠️ Unzoned Territory Gap</strong>
                  <p className="text-muted-foreground">This interior catchment zone is not yet covered by any community sub-polygon.</p>
                </div>
              </Popup>
            </Polygon>
          ))}

          {showGap && missedAnalysis?.uncoveredInteriorGeoJson && (
            <GeoJSON
              key={JSON.stringify(missedAnalysis.uncoveredInteriorGeoJson)}
              data={missedAnalysis.uncoveredInteriorGeoJson}
              interactive={!drawMode}
              style={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.22, weight: 2, dashArray: "4,4" }}
            />
          )}

          {/* Missed / Orphaned Zero-Dose Communities */}
          {missedAnalysis?.missedCommunities?.map((mc: any) => (
            <CircleMarker
              key={`missed-${mc.id}`}
              center={[mc.latitude, mc.longitude]}
              interactive={!drawMode}
              radius={mc.category === "orphaned_zero_dose" ? 7 : 5}
              pathOptions={{
                color: mc.category === "orphaned_zero_dose" ? "#dc2626" : "#f59e0b",
                fillColor: mc.category === "orphaned_zero_dose" ? "#ef4444" : "#fbbf24",
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <strong className={mc.category === "orphaned_zero_dose" ? "text-red-700 font-bold" : "text-amber-700 font-bold"}>
                    {mc.category === "orphaned_zero_dose" ? "⚠️ Orphaned Zero-Dose Settlement" : "ℹ️ Unzoned Community"}
                  </strong>
                  <p className="font-semibold">{mc.name}</p>
                  <p className="text-muted-foreground">{mc.explanation}</p>
                  <p className="text-muted-foreground">Est. Pop: {mc.populationEstimate?.toLocaleString() ?? "N/A"}</p>
                  {mc.distanceToFacilityKm != null && <p className="text-muted-foreground">Dist: {mc.distanceToFacilityKm.toFixed(1)} km</p>}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Extracted place markers */}
          {extractResult?.unmapped.map((u, i) => (
            <Marker key={`osm-${i}`} position={[u.latitude, u.longitude]} interactive={!drawMode}>
              <Popup><strong>{u.name}</strong><br />{u.placeType} - OpenStreetMap</Popup>
            </Marker>
          ))}
          {extractResult?.settlements.map((s) => (
            <Marker key={`settle-${s.id}`} position={[s.latitude, s.longitude]} interactive={!drawMode}>
              <Popup><strong>{s.name}</strong><br />Pop est: {s.populationEstimate?.toLocaleString() ?? "?"}</Popup>
            </Marker>
          ))}

          {/* Facility Pin Marker */}
          <Marker position={center} icon={facilityPinIcon} interactive={!drawMode}>
            <Popup>
              <div className="p-1.5 space-y-1 text-xs select-none">
                <div className="border-b border-border/50 pb-1">
                  <span className="text-[10px] font-semibold text-primary uppercase">Health Facility</span>
                  <p className="font-bold text-sm text-foreground leading-tight">{facilityName}</p>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
                  <span>Communities: <strong className="text-foreground">{effectiveCommunities.length}</strong></span>
                  {catchment?.gridPopulation ? (
                    <span>Catchment Pop: <strong className="text-foreground">{catchment.gridPopulation.toLocaleString()}</strong></span>
                  ) : null}
                </div>
              </div>
            </Popup>
          </Marker>

          {/* Community Settlement Location Pins */}
          {showCommunityPins &&
            effectiveCommunities.map((c) => {
              if (c.latitude == null || c.longitude == null || isNaN(c.latitude) || isNaN(c.longitude)) return null;
              const poly = communityPolygons.find((p) => p.communityName === c.name);
              const isSelected = selectedCommunity === c.name;
              const isMapped = !!poly?.saved;
              return (
                <Marker
                  key={`comm-pin-${c.id ?? c.villageId ?? c.name}`}
                  position={[c.latitude, c.longitude]}
                  icon={communityPinIcon(c.name, isSelected, isMapped)}
                  interactive={!drawMode}
                  eventHandlers={{
                    click: () => {
                      setSelectedCommunity(c.name);
                    },
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1.5 p-1 select-none min-w-[170px]">
                      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                        <strong className="font-bold text-foreground text-sm">{c.name}</strong>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            poly?.saved
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : poly
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {poly?.saved ? "🟢 Mapped" : poly ? "🟠 Draft Polygon" : "⚪ No Boundary"}
                        </span>
                      </div>
                      {c.targetPopulation && (
                        <p className="text-muted-foreground text-[11px]">
                          Target Headcount: <strong className="text-foreground">~{parseInt(c.targetPopulation).toLocaleString()}</strong>
                        </p>
                      )}
                      {poly?.areaSqKm && (
                        <p className="text-muted-foreground text-[11px]">
                          Demarcated Area: <strong className="text-foreground">{poly.areaSqKm.toFixed(2)} km²</strong>
                        </p>
                      )}
                      {facilityLat != null && facilityLng != null && (
                        <p className="text-muted-foreground text-[11px]">
                          Dist to HF:{" "}
                          <strong className="text-foreground">
                            {turf
                              .distance(
                                turf.point([facilityLng, facilityLat]),
                                turf.point([c.longitude, c.latitude]),
                                { units: "kilometers" }
                              )
                              .toFixed(1)}{" "}
                            km
                          </strong>
                        </p>
                      )}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCommunity(c.name);
                            if (!poly && catchment) {
                              setDrawMode("community");
                            }
                          }}
                          className="w-full rounded-md bg-primary px-2.5 py-1 text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                        >
                          {poly ? "🔍 Focus Community" : "✏️ Draw Boundary"}
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          <DrawingController
            mode={drawMode}
            onClose={() => setDrawMode(null)}
            onPolygonComplete={handlePolygonComplete}
            snapCoords={snapCoords}
            allowedBoundary={drawMode === "community" ? catchment?.coords : undefined}
            onInvalidPoint={() => toast({
              title: "Point outside HF catchment",
              description: "Community sub-polygons must remain inside the locked facility catchment.",
              variant: "destructive",
            })}
            onPointCountChange={setActiveVertexCount}
            finishTriggerRef={finishTriggerRef}
          />

          <FitToPolygon coords={fitCoords} />
          <GeolocateButton />
        </MapContainer>

        <BasemapSwitcher basemap={basemap} onChange={setBasemap} />

        {/* Top-Left Overlays & Pin Controls */}
        <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowCommunityPins((v) => !v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold shadow-md border backdrop-blur-sm transition-colors flex items-center gap-1.5 ${
              showCommunityPins ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "bg-white/90 border-gray-200 text-muted-foreground"
            }`}
          >
            <span>📍 Community Pins</span>
            <span className="text-[10px] opacity-75 font-normal">
              ({communities.filter((c) => c.latitude != null && !isNaN(c.latitude)).length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowGap((v) => !v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold shadow-md border backdrop-blur-sm transition-colors ${
              showGap ? "bg-red-50 border-red-300 text-red-700 font-bold" : "bg-white/90 border-gray-200 text-muted-foreground"
            }`}
          >
            {showGap ? "Hide Gaps" : "Show Gaps"}
          </button>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] rounded-xl border bg-white/95 dark:bg-slate-900/95 p-3 shadow-md backdrop-blur-sm text-[11px] font-medium space-y-1.5 min-w-[160px] pointer-events-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Map Legend</div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-[#1a56db] bg-[#1a56db]/15" />
            <span>HF Catchment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-[#e67e22] bg-[#e67e22]/25" />
            <span>Community Sub-Polygon</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white shadow-xs" />
            <span>Mapped Community Pin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 border border-white shadow-xs" />
            <span>Pending Community Pin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-red-500 bg-red-500/20" />
            <span>Uncovered Interior Gap</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-red-300" />
            <span>Zero-Dose Settlement</span>
          </div>
        </div>
      </div>

      {/* ── Population Balance Bar ── */}
      {catchment && (
        <div className="rounded-xl border bg-card p-3.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Population Attribution Balance</span>
            <span className={`font-extrabold tabular-nums ${isPopulationOverAllocated ? "text-red-600" : balancePct >= 90 ? "text-green-600" : balancePct >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {communityPopSum.toLocaleString()} / {catchmentPop.toLocaleString()} ({balancePct}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ${isPopulationOverAllocated ? "bg-red-500" : balancePct >= 90 ? "bg-green-500" : balancePct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${balancePct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {communityPolygons.length} of {communities.length} community polygons demarcated •{" "}
            {isPopulationOverAllocated
              ? `⚠ Raw sub-polygon estimates total ${rawCommunityPopSum.toLocaleString()} (${rawBalancePct}%). Values are normalized to the HF catchment total; review polygon overlaps and population sources.`
              : catchmentPop > communityPopSum
              ? `~${(catchmentPop - communityPopSum).toLocaleString()} population remaining unassigned in catchment area`
              : communityPolygons.length > 0
                ? "✓ 100% of catchment population attributed to community sub-polygons"
                : "Draw community polygons to allocate target headcounts"}
          </p>
        </div>
      )}

      {/* ── Community Coverage Checklist ── */}
      {effectiveCommunities.length > 0 && (
        <div className="rounded-xl border bg-card p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Community Coverage List ({communityPolygons.length}/{effectiveCommunities.length} Mapped)
            </h4>
            {catchment && (
              <div className="flex items-center gap-2">
                <select
                  value={extractBufferKm}
                  onChange={(e) => setExtractBufferKm(parseFloat(e.target.value))}
                  className="text-xs rounded border px-2 py-1 bg-background text-foreground"
                >
                  <option value={0.5}>0.5 km buffer</option>
                  <option value={1.5}>1.5 km buffer</option>
                  <option value={3.0}>3.0 km buffer</option>
                  <option value={5.0}>5.0 km buffer</option>
                </select>
                <button
                  type="button"
                  onClick={extractCommunities}
                  disabled={extracting}
                  className="text-xs px-2.5 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold hover:bg-sky-100"
                >
                  {extracting ? "Extracting..." : "Extract Places"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {effectiveCommunities.map((c, i) => {
              const poly = communityPolygons.find((p) => p.communityName === c.name);
              const isSelected = selectedCommunity === c.name;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedCommunity(c.name)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    poly
                      ? isSelected
                        ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-500/30"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : isSelected
                        ? "border-orange-600 bg-orange-100 text-orange-900 ring-2 ring-orange-500/30"
                        : "border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100"
                  }`}
                >
                  <span>{poly ? "🟢" : "🔴"}</span>
                  <span>{c.name}</span>
                  {poly?.griddedPopulation
                    ? ` (~${displayCommunityPopulation(poly).toLocaleString()}${isPopulationOverAllocated ? " adjusted" : ""})`
                    : ""}
                </button>
              );
            })}
          </div>

          {uncovered.length > 0 && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
              <div>
                <p className="text-xs font-bold text-red-800 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span>{uncovered.length} unmapped communities detected (Vaccination Coverage Risk)</span>
                </p>
                <p className="mt-0.5 text-[11px] text-red-700">
                  {uncovered.slice(0, 5).map((c) => c.name).join(", ")}
                  {uncovered.length > 5 ? ` +${uncovered.length - 5} more` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={flagUncovered}
                className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-xs"
              >
                Flag to District
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Missed Communities & Gap Intelligence Panel ── */}
      {missedAnalysis && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Crosshair className="h-4 w-4 text-red-600" />
                Missed Communities & Spatial Gap Analysis
              </span>
              {missedAnalysis.missedCommunitiesCount > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-800">
                  {missedAnalysis.missedCommunitiesCount} detected
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                  0 missed
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={fetchMissedCommunities}
              disabled={loadingMissed}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              {loadingMissed ? "Refreshing..." : "🔄 Refresh Analysis"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border bg-muted/40 p-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">Uncovered Catchment Gap</span>
              <p className="text-base font-extrabold text-foreground mt-0.5">
                {missedAnalysis.uncoveredAreaSqKm?.toFixed(2) ?? "0.00"} km²
              </p>
            </div>
            <div className="rounded-lg border bg-red-50/50 border-red-200/60 p-2.5">
              <span className="text-[11px] font-semibold text-red-800">Orphaned Zero-Dose Hamlets</span>
              <p className="text-base font-extrabold text-red-800 mt-0.5">
                {missedAnalysis.missedCommunities?.filter((m: any) => m.category === "orphaned_zero_dose").length ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-amber-50/50 border-amber-200/60 p-2.5">
              <span className="text-[11px] font-semibold text-amber-800">Unzoned In-Catchment</span>
              <p className="text-base font-extrabold text-amber-800 mt-0.5">
                {missedAnalysis.missedCommunities?.filter((m: any) => m.category === "unzoned_in_catchment").length ?? 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step-by-Step Polygon Drawing Guide Dialog ── */}
      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2 text-indigo-600">
              <BookOpen className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-foreground">
                Catchment Mapping & Polygon Drawing Guide
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Master the workflow for tracing master facility boundaries, defining community sub-polygons, and auto-clipping overlaps.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="workflow" className="mt-3 space-y-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="workflow" className="text-xs font-semibold">
                🚀 Step-by-Step Workflow
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="text-xs font-semibold">
                ⌨️ Shortcuts & Controls
              </TabsTrigger>
              <TabsTrigger value="gaps" className="text-xs font-semibold">
                🛡️ Overlaps & Zero-Dose Gaps
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workflow" className="space-y-3.5 text-xs text-foreground">
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-lg border bg-blue-50/60 border-blue-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">1</span>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-blue-900">Step 1: Draw Health Facility Catchment</p>
                    <p className="text-blue-800 leading-relaxed">
                      Click <strong>✏️ Draw HF Catchment</strong>. Click on the map to outline the facility’s master perimeter. Double-click or click <strong>Finish Shape</strong> to close the polygon, review the WorldPop gridded headcount, and click <strong>Save & Lock Catchment</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border bg-orange-50/60 border-orange-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[11px] font-bold text-white">2</span>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-orange-900">Step 2: Demarcate Community Sub-Polygons</p>
                    <p className="text-orange-800 leading-relaxed">
                      Select a village from the <strong>Community dropdown</strong> and click <strong>✏️ Draw Polygon</strong>. Trace the sub-polygon. Green snap indicators magnetically lock to the HF boundary and sibling borders.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg border bg-emerald-50/60 border-emerald-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">3</span>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-emerald-900">Step 3: 1-Click Auto-Clip & Save</p>
                    <p className="text-emerald-800 leading-relaxed">
                      If an overlap occurs, click <strong>⚡ Auto-Clip to Free Space</strong>. The system cleanly trims overlapping areas using Boolean spatial geometry with zero overlap. Then click <strong>Save</strong> or <strong>Save All</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shortcuts" className="space-y-3 text-xs">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Action</th>
                      <th className="p-2.5">Shortcut / Control</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    <tr>
                      <td className="p-2.5 font-semibold">Place Vertex</td>
                      <td className="p-2.5"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">Left Click</kbd></td>
                      <td className="p-2.5 text-muted-foreground">Adds a vertex point on the map.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">Finish Polygon</td>
                      <td className="p-2.5"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">Double Click</kbd> or Button</td>
                      <td className="p-2.5 text-muted-foreground">Closes shape and computes population.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">Undo Last Vertex</td>
                      <td className="p-2.5"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">Ctrl + Z</kbd></td>
                      <td className="p-2.5 text-muted-foreground">Removes the most recent point.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">Cancel Drawing</td>
                      <td className="p-2.5"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono">Escape (Esc)</kbd></td>
                      <td className="p-2.5 text-muted-foreground">Cancels active drawing mode.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold">Magnetic Snapping</td>
                      <td className="p-2.5"><span className="inline-flex items-center gap-1 font-bold text-emerald-600">🟢 Emerald Lock</span></td>
                      <td className="p-2.5 text-muted-foreground">Snaps within 18px of existing boundaries.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="gaps" className="space-y-3 text-xs">
              <div className="space-y-2.5">
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-1">
                  <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Overlap Prevention
                  </p>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    VaxPlan enforces strict spatial containment. Community sub-polygons must reside inside the master HF catchment boundary without colliding with neighboring villages. Use <strong>⚡ Auto-Clip</strong> to resolve boundaries instantly.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-red-200 bg-red-50/60 space-y-1">
                  <p className="font-semibold text-red-900 flex items-center gap-1.5">
                    <Crosshair className="h-4 w-4 text-red-600" />
                    Reaching Zero-Dose Settlements
                  </p>
                  <p className="text-red-800 leading-relaxed text-[11px]">
                    Settlements flagged with red circles are unallocated zero-dose zones. Ensure all villages have demarcated sub-polygons to guarantee routine immunization outreach.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
