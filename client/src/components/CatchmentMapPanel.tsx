/**
 * CatchmentMapPanel - Interactive polygon drawing tool for HF catchments & communities
 *
 * Features:
 *  - Draw HF catchment polygon + community sub-polygons
 *  - Server-side population from population_grids (PostGIS/GeoTIFF)
 *    with 3-source cascade: local DB -> WorldPop WOPR -> WorldPop REST -> area-density
 *  - Interactive controls: undo vertex (Ctrl+Z), Escape to cancel, satellite/OSM toggle,
 *    geolocation, fit-to-catchment zoom
 *  - Gap visualization - uncovered area within catchment rendered as red hatched overlay
 *  - Population balance panel - community sum vs catchment total
 *  - "Extract Communities" - aggressive OSM + settlements scraping
 *  - Flag uncovered communities to district officials
 *  - Save All in one click
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer, TileLayer, Polygon, Marker, Popup, GeoJSON, useMap,
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
import "leaflet/dist/leaflet.css";

// --- Colour palette for community polygons ------------------------------------
const PALETTE = [
  "#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6",
  "#1abc9c","#e67e22","#e91e63","#00bcd4","#8bc34a",
  "#ff5722","#607d8b","#795548","#ff9800","#4caf50",
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
  communities: { id?: number; villageId?: number; name: string; targetPopulation?: string }[];
  onCommunityPopUpdate: (name: string, population: number) => void;
  onExtractedCommunities?: (names: string[]) => void;
}

// --- Tile layers --------------------------------------------------------------
/* Commented out original tile layers configuration for dynamic/persisted basemaps
const TILES = {
  positron: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attr: "(c) OpenStreetMap contributors (c) CARTO" },
  voyager: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", attr: "(c) OpenStreetMap contributors (c) CARTO" },
};
*/

// --- Convert [lat,lng] coords array to GeoJSON Polygon ring ------------------
function toGeoRing(coords: [number, number][]): [number, number][] {
  return [...coords.map(([lat, lng]) => [lng, lat] as [number, number]), [coords[0][1], coords[0][0]] as [number, number]];
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
    const feature = turf.polygon([toGeoRing(coords)]);
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
      validationStatus: "draft",
      approvalStatus: "draft",
      populationMethod: "Pending server calculation",
      confidence: "low",
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
  const geojson = { type: "Polygon", coordinates: [ring] };

  try {
    const r = await apiRequest<IntelligenceResult>("POST", "/api/gis/polygons/intelligence", { geometry: geojson, ownerType, ownerId });
    return r;
  } catch (e) {
    console.error("Intelligence API failed:", e);
    return null;
  }
}


// --- Drawing controller - click to place vertices, dblclick to close ----------
function DrawingController({
  mode, onClose, onPolygonComplete,
}: {
  mode: "catchment" | "community" | null;
  onClose: () => void;
  onPolygonComplete: (coords: [number, number][]) => void;
}) {
  const map = useMap();
  const pointsRef = useRef<[number, number][]>([]);
  const lgRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mode) return;
    pointsRef.current = [];
    const lg = L.layerGroup().addTo(map);
    lgRef.current = lg;
    map.getContainer().style.cursor = "crosshair";
    const color = mode === "catchment" ? "#1a56db" : "#e74c3c";

    const redraw = () => {
      lg.clearLayers();
      const pts = pointsRef.current;
      if (pts.length > 1) {
        L.polyline([...pts, pts[0]], { color, weight: 2, dashArray: "6,4", opacity: 0.85 }).addTo(lg);
      }
      pts.forEach((pt) =>
        L.circleMarker(pt, { radius: 4, color: "#fff", fillColor: color, fillOpacity: 1, weight: 1.5 }).addTo(lg)
      );
    };

    const onClick = (e: L.LeafletMouseEvent) => {
      pointsRef.current = [...pointsRef.current, [e.latlng.lat, e.latlng.lng]];
      redraw();
    };
    const onDblClick = () => {
      if (pointsRef.current.length < 3) return;
      lg.clearLayers();
      L.polygon(pointsRef.current, { color, fillOpacity: 0.15 }).addTo(lg);
      onPolygonComplete([...pointsRef.current]);
      cleanup();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); cleanup(); }
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (pointsRef.current.length > 0) {
          pointsRef.current = pointsRef.current.slice(0, -1);
          redraw();
        }
      }
    };

    const cleanup = () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      document.removeEventListener("keydown", onKey);
      map.getContainer().style.cursor = "";
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    document.addEventListener("keydown", onKey);

    return () => {
      cleanup();
      if (lgRef.current) { map.removeLayer(lgRef.current); lgRef.current = null; }
    };
  }, [mode, map, onPolygonComplete, onClose]);

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
      
    </button>
  );
}

function PolygonDetails({ title, meta, population }: { title: string; meta: PolygonPlanningMeta; population?: number }) {
  const access = meta.access ?? undefined;
  return (
    <div className="rounded-lg border bg-card p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{title}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${meta.validationStatus === "valid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {meta.validationStatus || "draft"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground md:grid-cols-4">
        <span>Total pop: <b className="text-foreground">{(population ?? meta.populationEstimate ?? 0).toLocaleString()}</b></span>
        <span>Target infants: <b className="text-foreground">{(meta.targetInfants ?? meta.underOne ?? 0).toLocaleString()}</b></span>
        <span>Under-five: <b className="text-foreground">{(meta.underFive ?? 0).toLocaleString()}</b></span>
        <span>Area: <b className="text-foreground">{meta.areaSqKm != null ? Number(meta.areaSqKm).toFixed(2) : "-"} km²</b></span>
        <span>Distance: <b className="text-foreground">{access?.centroidDistanceKm != null ? `${access.centroidDistanceKm} km` : "-"}</b></span>
        <span>Walk: <b className="text-foreground">{access?.travelTimeWalkingMin != null ? `${access.travelTimeWalkingMin} min` : "-"}</b></span>
        <span>Motorbike: <b className="text-foreground">{access?.travelTimeMotorcycleMin != null ? `${access.travelTimeMotorcycleMin} min` : "-"}</b></span>
        <span>Vehicle: <b className="text-foreground">{access?.travelTimeVehicleMin != null ? `${access.travelTimeVehicleMin} min` : "-"}</b></span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Source: {meta.populationSource || "Population source missing"}{meta.populationSourceYear ? ` ${meta.populationSourceYear}` : ""} · Method: {meta.populationMethod || "Pending calculation"} · Confidence: {meta.confidence || "low"}
      </p>
      {meta.warnings && meta.warnings.length > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">{meta.warnings[0]}</p>
      )}
    </div>
  );
}
// --- Main component -----------------------------------------------------------
export function CatchmentMapPanel({
  facilityId, facilityName,
  facilityLat = -6.314, facilityLng = 143.956,
  communities, onCommunityPopUpdate, onExtractedCommunities,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canCreatePolygon = hasAnyPermission(user, ["polygon.create", "manage_boundaries"]);
  const canEditPolygon = hasAnyPermission(user, ["polygon.edit", "manage_boundaries"]);
  const canReplacePolygon = hasAnyPermission(user, ["polygon.replace", "manage_boundaries"]);
  const canViewHistory = hasAnyPermission(user, ["polygon.view_history", "manage_boundaries"]);
  const canApprovePolygon = hasAnyPermission(user, ["polygon.approve"]);
  const canDeleteDraft = hasAnyPermission(user, ["polygon.delete_draft", "manage_boundaries"]);
  const canArchivePolygon = hasAnyPermission(user, ["polygon.archive", "manage_boundaries"]);
  const canRecalculatePopulation = hasAnyPermission(user, ["polygon.recalculate_population", "manage_boundaries"]);

  const queryClient = useQueryClient();
  const userRole = (user?.role || "").toLowerCase();
  const userRoles: string[] = Array.isArray(user?.roles) ? user?.roles.map((r: any) => String(r).toLowerCase()) : [];
  const allowedAdminManagerRoles = ["platform_admin", "national_admin", "national_manager", "gis_specialist", "provincial_coordinator", "district_manager", "admin", "manager"];
  const isNationalAdminOrManager = allowedAdminManagerRoles.includes(userRole) || userRoles.some(r => allowedAdminManagerRoles.includes(r));
  const canDeleteActivePolygon = isNationalAdminOrManager || hasAnyPermission(user, ["polygon.delete", "polygon.archive", "manage_boundaries"]);

  const [deletingFacilityCatchment, setDeletingFacilityCatchment] = useState(false);
  const [deletingCommunityId, setDeletingCommunityId] = useState<number | null>(null);

  const handleDeleteFacilityCatchment = async () => {
    if (!facilityId) return;
    const confirmed = window.confirm(`Are you sure you want to delete the facility catchment polygon for ${facilityName}? This will reset the catchment boundary and population estimate.`);
    if (!confirmed) return;

    setDeletingFacilityCatchment(true);
    try {
      await apiRequest("DELETE", `/api/facilities/${facilityId}/catchment-polygon`);
      setCatchment(null);
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: [`/api/facilities/${facilityId}/catchment-polygon`] });
      toast({ title: "Catchment polygon deleted", description: `The facility catchment polygon for ${facilityName} has been deleted.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Failed to delete catchment polygon", variant: "destructive" });
    } finally {
      setDeletingFacilityCatchment(false);
    }
  };

  const handleDeleteCommunityPolygon = async (villageId: number) => {
    const communityName = selectedCommunity || "this community";
    const confirmed = window.confirm(`Are you sure you want to delete the community polygon for ${communityName}? This will reset the community boundary.`);
    if (!confirmed) return;

    setDeletingCommunityId(villageId);
    try {
      await apiRequest("DELETE", `/api/villages/${villageId}/community-polygon`);
      setCommunityPolygons((prev) => prev.filter((p) => p.communityId !== villageId && p.communityName !== communityName));
      queryClient.invalidateQueries({ queryKey: ["/api/villages"] });
      queryClient.invalidateQueries({ queryKey: [`/api/villages/${villageId}/community-polygon`] });
      toast({ title: "Community polygon deleted", description: `The community polygon for ${communityName} has been deleted.` });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err?.message || "Failed to delete community polygon", variant: "destructive" });
    } finally {
      setDeletingCommunityId(null);
    }
  };
  const [catchment, setCatchment] = useState<CatchmentPolygon | null>(null);
  const [communityPolygons, setCommunityPolygons] = useState<CommunityPolygon[]>([]);
  const [drawMode, setDrawMode] = useState<"catchment" | "community" | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingPop, setLoadingPop] = useState(false);
  // Original local tileLayer state commented out for persisted basemaps
  // const [tileLayer, setTileLayer] = useState<"positron" | "voyager">("positron");
  const [basemap, setBasemap] = usePersistedBasemap("positron");
  const [fitCoords, setFitCoords] = useState<[number, number][] | null>(null);
  const [extracting, setExtracting] = useState(false);
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

  const activeLifecycleCoords = lifecycleEdit?.entityType === "facility"
    ? catchment?.coords
    : communityPolygons.find((poly) => poly.communityId === lifecycleEdit?.entityId)?.coords;

  useEffect(() => {
    if (!lifecycleEdit || !activeLifecycleCoords || activeLifecycleCoords.length < 3) {
      setLifecycleValidation(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      setValidationBusy(true);
      try {
        const result = await apiRequest<LifecycleValidation>(
          "POST",
          "/api/polygons/" + lifecycleEdit.entityType + "/" + lifecycleEdit.entityId + "/validate",
          { geometry: { type: "Polygon", coordinates: [toGeoRing(activeLifecycleCoords)] } },
        );
        setLifecycleValidation(result);
      } catch (error: any) {
        const data = error?.data || error;
        setLifecycleValidation(data?.blockingErrors ? data : {
          valid: false,
          blockingErrors: [{ code: "VALIDATION_FAILED", message: error?.message || "Polygon validation failed." }],
          warnings: [],
          information: [],
        });
      } finally {
        setValidationBusy(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [lifecycleEdit, activeLifecycleCoords]);

  const beginFacilityLifecycle = (action: LifecycleAction) => {
    if (!catchment) return;
    setLifecycleEdit({ entityType: "facility", entityId: facilityId, action, originalCoords: catchment.coords.map((coord) => [...coord] as [number, number]) });
    setPendingVersion(null);
    setLifecycleValidation(null);
    if (action === "edit") {
      setCatchment((current) => current ? { ...current, locked: false } : current);
    } else {
      setDrawMode("catchment");
    }
  };

  const selectedCommunityRecord = communities.find((community) => community.name === selectedCommunity);
  const selectedCommunityPolygon = communityPolygons.find((polygon) => polygon.communityName === selectedCommunity);

  const beginCommunityLifecycle = (action: LifecycleAction) => {
    if (!selectedCommunityRecord?.villageId || !selectedCommunityPolygon) return;
    setLifecycleEdit({
      entityType: "village",
      entityId: selectedCommunityRecord.villageId,
      action,
      originalCoords: selectedCommunityPolygon.coords.map((coord) => [...coord] as [number, number]),
    });
    setPendingVersion(null);
    setLifecycleValidation(null);
    if (action === "edit") {
      setCommunityPolygons((rows) => rows.map((polygon) => polygon.communityName === selectedCommunity ? { ...polygon, saved: false } : polygon));
    } else {
      setDrawMode("community");
    }
  };

  const cancelLifecycleEdit = () => {
    if (!lifecycleEdit) return;
    if (lifecycleEdit.entityType === "facility") {
      setCatchment((current) => current ? { ...current, coords: lifecycleEdit.originalCoords, locked: true } : current);
    } else {
      setCommunityPolygons((rows) => rows.map((polygon) => polygon.communityId === lifecycleEdit.entityId
        ? { ...polygon, coords: lifecycleEdit.originalCoords, saved: true }
        : polygon));
    }
    setLifecycleEdit(null);
    setLifecycleValidation(null);
    setPendingVersion(null);
  };

  const loadHistory = async (entityType: "facility" | "village", entityId: number, name: string) => {
    setHistoryOwner({ entityType, entityId, name });
    setHistoryBusy(true);
    setComparison(null);
    try {
      const rows = await apiRequest<LifecycleVersion[]>("GET", "/api/polygons/" + entityType + "/" + entityId + "/history");
      setHistoryRows(rows);
    } catch (error: any) {
      toast({ title: "History unavailable", description: error?.message, variant: "destructive" });
      setHistoryRows([]);
    } finally {
      setHistoryBusy(false);
    }
  };

  const refreshHistory = async () => {
    if (historyOwner) await loadHistory(historyOwner.entityType, historyOwner.entityId, historyOwner.name);
  };

  const lifecycleVersionAction = async (version: LifecycleVersion, action: "submit" | "approve" | "reject" | "archive" | "delete" | "recalculate-population") => {
    try {
      if (action === "delete") {
        await apiRequest("DELETE", "/api/polygons/" + version.id + "/draft");
      } else {
        const body: any = {};
        if (action === "reject") {
          const reason = window.prompt("Why is this polygon being rejected?");
          if (!reason?.trim()) return;
          body.reason = reason.trim();
        }
        if (action === "archive") {
          const reason = window.prompt("Why is this polygon being archived?");
          if (!reason?.trim()) return;
          body.reason = reason.trim();
        }
        if (action === "approve") {
          const reason = window.prompt("If this polygon has warnings, record the override reason. Otherwise leave blank.");
          if (reason?.trim()) body.overrideReason = reason.trim();
        }
        await apiRequest("POST", "/api/polygons/" + version.id + "/" + action, body);
      }
      toast({ title: "Polygon updated", description: "The lifecycle action was recorded successfully." });
      await refreshHistory();
    } catch (error: any) {
      toast({ title: "Polygon action failed", description: error?.message, variant: "destructive" });
    }
  };

  const compareLatestVersions = async () => {
    if (!historyOwner || historyRows.length < 2) return;
    const [to, from] = historyRows;
    try {
      const result = await apiRequest<any>("GET", "/api/polygons/" + historyOwner.entityType + "/" + historyOwner.entityId + "/compare?fromVersionId=" + from.id + "&toVersionId=" + to.id);
      setComparison(result);
    } catch (error: any) {
      toast({ title: "Comparison failed", description: error?.message, variant: "destructive" });
    }
  };
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
    communities.forEach((c) => {
      if (!c.villageId) return;
      apiRequest<any>("GET", `/api/villages/${c.villageId}/community-polygon`)
        .then((r) => {
          const display = r?.catchmentPolygon ? r : { ...r, ...(r?.draftPolygonDetails || {}), catchmentPolygon: r?.draftPolygon };
          const coords = coordsFromGeoJson(display?.catchmentPolygon);
          if (coords) {
            const meta = metaFromResponse(display);
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

  // --- Gap polygon = catchment minus union of community polygons --------------
  const gapPolygons: [number, number][][] = (() => {
    if (!catchment || !showGap || communityPolygons.length === 0) return [];
    try {
      const catchPoly = turf.polygon([toGeoRing(catchment.coords)]);
      const comFeatures = communityPolygons
        .filter((p) => p.coords.length >= 3)
        .map((p) => turf.polygon([toGeoRing(p.coords)]));
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

  // --- Overlap check ----------------------------------------------------------
  const hasOverlap = useCallback((newCoords: [number, number][]): boolean => {
    const newPoly = turf.polygon([toGeoRing(newCoords)]);
    return communityPolygons.some((existing) => {
      if (existing.communityName === selectedCommunity) return false;
      try { return turf.intersect(turf.featureCollection([newPoly, turf.polygon([toGeoRing(existing.coords)])])) !== null; }
      catch { return false; }
    });
  }, [communityPolygons, selectedCommunity]);

  // --- Handle completed polygon -----------------------------------------------
  const handlePolygonComplete = useCallback(async (coords: [number, number][]) => {
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
      setCatchment({ coords, gridPopulation: total || undefined, under5Population: under5 || undefined, populationEstimate: total || undefined, underFive: under5 || undefined, locked: false, ...localMeta });
      setFitCoords(coords);
      toast({
        title: lifecycleEdit?.action === "replace" ? "Replacement boundary drawn" : "Catchment drawn",
        description: total
          ? "~" + total.toLocaleString() + " people - " + under5.toLocaleString() + " under-5 (grid population)"
          : "Polygon ready - click Save to persist.",
      });
      return;
    }

    if (!selectedCommunity) {
      toast({ title: "No community selected", variant: "destructive" });
      return;
    }
    if (hasOverlap(coords)) {
      toast({ title: "Overlap detected", description: "This polygon overlaps another community. Adjust the boundary.", variant: "destructive" });
      return;
    }
    if (catchment) {
      const catchPoly = turf.polygon([toGeoRing(catchment.coords)]);
      if (!turf.booleanWithin(turf.polygon([toGeoRing(coords)]), catchPoly)) {
        toast({ title: "Outside catchment", description: "Community polygon must be fully inside the HF catchment area.", variant: "destructive" });
        return;
      }
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
      title: lifecycleEdit?.action === "replace" ? "Replacement boundary drawn" : '"' + selectedCommunity + '" drawn',
      description: total ? "~" + total.toLocaleString() + " people - " + under5.toLocaleString() + " under-5" : "Click Save to persist.",
    });
  }, [drawMode, selectedCommunity, catchment, communityPolygons, hasOverlap, onCommunityPopUpdate, toast, lifecycleEdit, facilityId, facilityLat, facilityLng, communities]);

  // --- Save catchment ---------------------------------------------------------
  const saveCatchment = async () => {
    if (!catchment || catchingRef.current) return;
    catchingRef.current = true;
    setSaving(true);
    try {
      let saved: any;
      const lifecycleAction = lifecycleEdit?.entityType === "facility" ? lifecycleEdit.action : "created";
      const isLifecycleSave = true;
      if (isLifecycleSave) {
        if (lifecycleValidation && !lifecycleValidation.valid) {
          throw new Error("Resolve the blocking polygon validation errors before saving.");
        }
        const reason = window.prompt(lifecycleAction === "created"
          ? "Describe why this facility catchment is being created:"
          : "Describe why this boundary is being " + (lifecycleAction === "replace" ? "replaced" : "changed") + ":");
        if (!reason?.trim()) return;
        const result = await apiRequest<any>(
          "POST",
          "/api/polygons/facility/" + facilityId + "/" + (lifecycleAction === "created" ? "create" : lifecycleAction),
          { geometry: { type: "Polygon", coordinates: [toGeoRing(catchment.coords)] }, changeReason: reason.trim() },
        );
        setPendingVersion(result.polygon);
        setHistoryOwner({ entityType: "facility", entityId: facilityId, name: facilityName });
        saved = { ...result.polygon, catchmentGridPopulation: result.polygon.populationEstimate, population: result.population };
      }
      const meta = metaFromResponse(saved);
      setCatchment((polygon) => polygon ? {
        ...polygon,
        locked: true,
        gridPopulation: saved.catchmentGridPopulation ?? saved.population?.totalPopulation ?? polygon.gridPopulation,
        under5Population: saved.population?.underFive ?? polygon.under5Population,
        ...meta,
      } : polygon);
      if (isLifecycleSave) {
        setLifecycleEdit(null);
        setLifecycleValidation(null);
      }
      toast({
        title: isLifecycleSave ? "Facility boundary draft created" : "Facility catchment saved",
        description: (saved.population?.totalPopulation ?? catchment.gridPopulation ?? 0).toLocaleString() + " people; " + (saved.areaSqKm?.toFixed?.(2) ?? saved.areaSqKm ?? "?") + " km2",
      });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
      catchingRef.current = false;
    }
  };

  // --- Save community polygon -------------------------------------------------
  const saveCommunity = async (polygon: CommunityPolygon) => {
    const community = communities.find((item) => item.name === polygon.communityName);
    if (!community?.villageId) {
      toast({ title: "Register community first", description: "Save the community record before drawing its polygon.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let saved: any;
      const lifecycleAction = lifecycleEdit?.entityType === "village" && lifecycleEdit.entityId === community.villageId
        ? lifecycleEdit.action
        : "created";
      const isLifecycleSave = true;
      if (isLifecycleSave) {
        if (lifecycleValidation && !lifecycleValidation.valid) {
          throw new Error("Resolve the blocking polygon validation errors before saving.");
        }
        const reason = window.prompt(lifecycleAction === "created"
          ? "Describe why this community boundary is being created:"
          : "Describe why this community boundary is being " + (lifecycleAction === "replace" ? "replaced" : "changed") + ":");
        if (!reason?.trim()) return;
        const result = await apiRequest<any>(
          "POST",
          "/api/polygons/village/" + community.villageId + "/" + (lifecycleAction === "created" ? "create" : lifecycleAction),
          { geometry: { type: "Polygon", coordinates: [toGeoRing(polygon.coords)] }, changeReason: reason.trim() },
        );
        setPendingVersion(result.polygon);
        setHistoryOwner({ entityType: "village", entityId: community.villageId, name: polygon.communityName });
        saved = { ...result.polygon, griddedPopulation: result.polygon.populationEstimate, population: result.population };
      }

      const meta = metaFromResponse(saved);
      setCommunityPolygons((previous) => previous.map((item) => item.communityName === polygon.communityName ? {
        ...item,
        saved: true,
        griddedPopulation: saved.griddedPopulation ?? saved.population?.totalPopulation ?? item.griddedPopulation,
        under5Population: saved.population?.underFive ?? item.under5Population,
        ...meta,
      } : item));
      if (isLifecycleSave) {
        setLifecycleEdit(null);
        setLifecycleValidation(null);
      }
      toast({
        title: isLifecycleSave ? "Community boundary draft created" : '"' + polygon.communityName + '" saved',
        description: (saved.population?.totalPopulation ?? polygon.griddedPopulation ?? 0).toLocaleString() + " people; " + (saved.areaSqKm?.toFixed?.(2) ?? saved.areaSqKm ?? "?") + " km2",
      });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Save all ----------------------------------------------------------------
  const saveAll = async () => {
    let count = 0;
    if (catchment && !catchment.locked) { await saveCatchment(); count++; }
    for (const poly of communityPolygons.filter((p) => !p.saved)) { await saveCommunity(poly); count++; }
    if (count === 0) toast({ title: "Nothing to save", description: "All polygons are already saved." });
  };

  // --- Auto-suggest Catchment (Convex Hull) -----------------------------------
  const autoSuggestCatchment = async () => {
    setSuggesting(true);
    try {
      const result = await apiRequest<any>("POST", "/api/gis/polygons/suggest", { facilityId });
      if (result.geometry && result.geometry.coordinates) {
        let coords: [number, number][];
        if (result.geometry.type === "Polygon") {
          coords = result.geometry.coordinates[0].map(([lng, lat]: number[]) => [lat, lng]);
        } else if (result.geometry.type === "MultiPolygon") {
          coords = result.geometry.coordinates[0][0].map(([lng, lat]: number[]) => [lat, lng]);
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

  // --- Extract communities (aggressive OSM scraping) --------------------------
  const extractCommunities = async () => {
    if (!catchment) { toast({ title: "Draw catchment first", variant: "destructive" }); return; }
    setExtracting(true);
    try {
      const result = await apiRequest<ExtractResult>("POST", "/api/catchments/extract", {
        geojson: { type: "Polygon", coordinates: [toGeoRing(catchment.coords)] },
        bufferMeters: 500,
        includeOsm: true,
      });
      setExtractResult(result);
      const total = result.counts.villages + result.counts.settlements + result.counts.unmapped;
      toast({
        title: `${total} community places extracted`,
        description: `${result.counts.villages} registered - ${result.counts.settlements} settlements - ${result.counts.unmapped} OSM places`,
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
  const communityPopSum = communityPolygons.reduce((s, p) => s + (p.griddedPopulation ?? 0), 0);
  const catchmentPop = catchment?.gridPopulation ?? 0;
  const balancePct = catchmentPop > 0 ? Math.min(100, Math.round((communityPopSum / catchmentPop) * 100)) : 0;

  const center: [number, number] = [facilityLat, facilityLng];

  return (
    <div className="flex flex-col gap-3">

      {/* -- Controls bar -- */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm [&_button]:min-h-9 [&_select]:min-h-9">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Catchment:</span>

        {!catchment ? (
          <button type="button" disabled={!!drawMode || !canCreatePolygon} onClick={() => setDrawMode("catchment")}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
             Draw HF Catchment
          </button>
        ) : (
          <>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${catchment.locked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
              {catchment.locked ? " Locked" : " Unsaved"}
            </span>
            {catchment.gridPopulation != null && (
              <span className="text-xs text-muted-foreground">
                ~{catchment.gridPopulation.toLocaleString()} people
                {catchment.under5Population ? ` - ${catchment.under5Population.toLocaleString()} U5` : ""}
              </span>
            )}
            {!catchment.locked && (
              <button type="button" onClick={saveCatchment} disabled={saving}
                className="rounded-md bg-green-600 px-3 py-1.5 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? "Saving..." : " Save & Lock"}
              </button>
            )}
            {catchment.locked && (
              <>
                {canEditPolygon && (
                  <button type="button" onClick={() => beginFacilityLifecycle("edit")}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Edit vertices</button>
                )}
                {canReplacePolygon && (
                  <button type="button" onClick={() => beginFacilityLifecycle("replace")}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Replace</button>
                )}
                {canViewHistory && (
                  <button type="button" onClick={() => loadHistory("facility", facilityId, facilityName)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">History</button>
                )}
                {canDeleteActivePolygon && (
                  <button type="button" onClick={handleDeleteFacilityCatchment} disabled={deletingFacilityCatchment}
                    className="rounded-md border border-red-300 bg-red-50 text-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                    {deletingFacilityCatchment ? "Deleting..." : "Delete Catchment"}
                  </button>
                )}
                <button type="button" onClick={() => setFitCoords(catchment.coords)}
                  className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"> Fit</button>
              </>
            )}
            {!catchment.locked && (
              <>
                <button type="button" onClick={autoSuggestCatchment} disabled={suggesting}
                    className="rounded-md border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                    {suggesting ? " Auto-suggesting..." : " Auto-suggest"}
                </button>
                {canDeleteActivePolygon && (
                  <button type="button" onClick={handleDeleteFacilityCatchment} disabled={deletingFacilityCatchment}
                    className="rounded-md border border-red-300 bg-red-50 text-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                    {deletingFacilityCatchment ? "Deleting..." : "Delete Catchment"}
                  </button>
                )}
              </>
            )}
          </>
        )}

        <div className="h-4 w-px bg-border mx-1" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Community:</span>

        <select className="min-w-0 max-w-full rounded border px-2 py-1 text-xs sm:max-w-[190px]" value={selectedCommunity}
          onChange={(e) => setSelectedCommunity(e.target.value)}>
          <option value="">- select -</option>
          {communities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}{communityPolygons.some((p) => p.communityName === c.name) ? " Done" : ""}
            </option>
          ))}
        </select>
        {!selectedCommunityPolygon ? (
          <button type="button" disabled={!selectedCommunity || !!drawMode || !catchment || !canCreatePolygon}
            onClick={() => setDrawMode("community")}
            className="rounded-md bg-orange-500 px-3 py-1.5 text-white text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
            Draw Polygon
          </button>
        ) : (
          <>
            {canEditPolygon && (
              <button type="button" disabled={!!drawMode} onClick={() => beginCommunityLifecycle("edit")}
                className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">Edit vertices</button>
            )}
            {canReplacePolygon && (
              <button type="button" disabled={!!drawMode} onClick={() => beginCommunityLifecycle("replace")}
                className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">Replace</button>
            )}
            {canViewHistory && selectedCommunityRecord?.villageId && (
              <button type="button" onClick={() => loadHistory("village", selectedCommunityRecord.villageId!, selectedCommunity)}
                className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">History</button>
            )}
            {canDeleteActivePolygon && selectedCommunityRecord?.villageId && (
              <button type="button" onClick={() => handleDeleteCommunityPolygon(selectedCommunityRecord.villageId!)} disabled={deletingCommunityId === selectedCommunityRecord.villageId}
                className="rounded-md border border-red-300 bg-red-50 text-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                {deletingCommunityId === selectedCommunityRecord.villageId ? "Deleting..." : "Delete Polygon"}
              </button>
            )}
          </>
        )}

        <button type="button" disabled={!catchment || extracting} onClick={extractCommunities}
          className="rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50">
          {extracting ? " Extracting..." : " Extract Communities"}
        </button>
        <button type="button" onClick={saveAll} disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
           Save All
        </button>
      </div>

      {lifecycleEdit && (
        <div className={"rounded-md border px-3 py-2 text-xs " + (lifecycleValidation?.valid === false ? "border-red-300 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>{lifecycleEdit.action === "replace" ? "Replacement draft" : "Boundary correction"} in progress</strong>
            <button type="button" onClick={cancelLifecycleEdit} className="rounded border bg-white px-2 py-1">Cancel changes</button>
          </div>
          {validationBusy && <p className="mt-1">Validating geometry...</p>}
          {lifecycleValidation?.blockingErrors.map((issue) => <p key={issue.code} className="mt-1 font-medium">Blocked: {issue.message}</p>)}
          {lifecycleValidation?.warnings.map((issue) => <p key={issue.code} className="mt-1 text-amber-800">Warning: {issue.message}</p>)}
          {lifecycleValidation?.valid && <p className="mt-1 text-green-700">Geometry is valid. Saving creates a new draft version; the active boundary remains unchanged.</p>}
        </div>
      )}
      {pendingVersion && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span><strong>Draft version {pendingVersion.version} created.</strong> Review and submit it for approval when ready.</span>
          <button type="button" onClick={() => lifecycleVersionAction(pendingVersion, "submit")} className="rounded bg-emerald-700 px-3 py-1.5 font-medium text-white">Submit for approval</button>
        </div>
      )}
      {/* -- Drawing instructions -- */}
      {drawMode && (
        <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="flex-1 animate-pulse text-xs font-semibold text-blue-700">
             Click to place vertices - Double-click to close - Ctrl+Z undo - Esc cancel
          </span>
          <button type="button" onClick={() => setDrawMode(null)}
            className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200">
            Cancel (Esc)
          </button>
        </div>
      )}
      {loadingPop && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 animate-pulse">
           Estimating grid population from local GeoTIFF data / WorldPop cascade...
        </div>
      )}

      {/* -- Map -- */}
      <div className="relative h-[420px] w-full overflow-hidden rounded-xl border shadow-sm sm:h-[500px]">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} doubleClickZoom={false}>
          {/* Commented out original static TileLayer in favor of dynamic BasemapTileLayer
          <TileLayer url={TILES[tileLayer].url} attribution={TILES[tileLayer].attr} maxNativeZoom={19} maxZoom={22} />
          */}
          <BasemapTileLayer basemap={basemap} />

          {/* HF Catchment polygon */}
          {catchment && (
            <Polygon positions={catchment.coords}
              pathOptions={{ color: catchment.validationStatus === "invalid" ? "#ef4444" : "#1a56db", fillColor: "#1a56db", fillOpacity: catchment.locked ? 0.10 : 0.06, weight: catchment.locked ? 3 : 2.5, dashArray: catchment.locked ? undefined : "8,4" }}>
              <Popup>
                <strong>{facilityName} - HF Catchment</strong><br />
                Grid pop: ~{(catchment.gridPopulation ?? 0).toLocaleString()}<br />
                Under-5: ~{(catchment.under5Population ?? 0).toLocaleString()}<br />
                {catchment.locked ? " Locked" : "Warning: Unsaved"}
              </Popup>
            </Polygon>
          )}

          {/* Community polygons */}
          {communityPolygons.map((poly) => (
            <Polygon key={poly.communityName} positions={poly.coords}
              pathOptions={{ color: poly.validationStatus === "invalid" ? "#ef4444" : poly.color, fillColor: poly.color, fillOpacity: poly.communityName === selectedCommunity ? 0.30 : 0.18, weight: poly.communityName === selectedCommunity ? 4 : 2, dashArray: poly.saved ? undefined : "7,4" }}>
              <Popup>
                <strong>{poly.communityName}</strong><br />
                Grid pop: ~{(poly.griddedPopulation ?? 0).toLocaleString()}<br />
                Under-5: ~{(poly.under5Population ?? 0).toLocaleString()}<br />
                {poly.saved ? "Saved Saved" : (
                  <>
                    <span>Warning: Unsaved</span><br />
                    <button onClick={() => saveCommunity(poly)} disabled={saving}
                      style={{ marginTop: 4, padding: "2px 10px", background: "#1a56db", color: "#fff", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11 }}>
                      Save
                    </button>
                  </>
                )}
              </Popup>
            </Polygon>
          ))}

          {/* Gap overlay - red hatched uncovered area */}
          {gapPolygons.map((ring, i) => (
            <Polygon key={`gap-${i}`} positions={ring}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.16, weight: 1.5, dashArray: "5,4" }}>
              <Popup>
                <strong style={{ color: "#ef4444" }}>Warning: Coverage Gap</strong><br />
                This area within the catchment is not yet covered by a community polygon.
              </Popup>
            </Polygon>
          ))}

          {/* Extracted place markers */}
          {extractResult?.unmapped.map((u, i) => (
            <Marker key={`osm-${i}`} position={[u.latitude, u.longitude]}>
              <Popup><strong>{u.name}</strong><br />{u.placeType} - OpenStreetMap</Popup>
            </Marker>
          ))}
          {extractResult?.settlements.map((s) => (
            <Marker key={`settle-${s.id}`} position={[s.latitude, s.longitude]}>
              <Popup><strong>{s.name}</strong><br />Pop est: {s.populationEstimate?.toLocaleString() ?? "?"}</Popup>
            </Marker>
          ))}

          {/* Facility marker */}
          <Marker position={center}>
            <Popup>
              <div className="p-1.5 space-y-1 text-xs select-none">
                <div className="border-b border-border/50 pb-1">
                  <span className="text-[10px] font-semibold text-primary uppercase">Health Facility</span>
                  <p className="font-bold text-sm text-foreground leading-tight">{facilityName}</p>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-0.5">
                  <span>Communities: <strong className="text-foreground">{communities.length}</strong></span>
                  {catchment?.gridPopulation ? (
                    <span>Catchment Pop: <strong className="text-foreground">{catchment.gridPopulation.toLocaleString()}</strong></span>
                  ) : null}
                </div>
              </div>
            </Popup>
          </Marker>

          {lifecycleEdit?.action === "edit" && lifecycleEdit.entityType === "facility" && catchment && (
            <VertexEditor
              coords={catchment.coords}
              color="#1a56db"
              onChange={(coords) => setCatchment((current) => current ? { ...current, coords, locked: false, ...localPolygonMeta(coords, facilityLat, facilityLng) } : current)}
            />
          )}
          {lifecycleEdit?.action === "edit" && lifecycleEdit.entityType === "village" && selectedCommunityPolygon && (
            <VertexEditor
              coords={selectedCommunityPolygon.coords}
              color={selectedCommunityPolygon.color}
              onChange={(coords) => setCommunityPolygons((rows) => rows.map((polygon) => polygon.communityId === lifecycleEdit.entityId ? { ...polygon, coords, saved: false, ...localPolygonMeta(coords, facilityLat, facilityLng) } : polygon))}
            />
          )}
          <DrawingController mode={drawMode} onClose={() => setDrawMode(null)} onPolygonComplete={handlePolygonComplete} />
          <FitToPolygon coords={fitCoords} />
          <GeolocateButton />
        </MapContainer>
        <BasemapSwitcher basemap={basemap} onChange={setBasemap} />
        {/* Map overlay controls (outside map, uses regular absolute positioning) */}
        <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1">
          <button type="button" onClick={() => setShowGap((v) => !v)}
            className={`rounded px-2 py-1 text-xs font-medium shadow border ${showGap ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-muted-foreground"}`}>
            {showGap ? " Hide Gaps" : " Show Gaps"}
          </button>
        </div>

        {/* Map Legend (bottom-4 left-4 overlay) */}
        <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur-sm text-[11px] font-medium space-y-1.5 min-w-[150px] pointer-events-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Map Legend</div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-[#1a56db] bg-[#1a56db]/10" />
            <span>Facility Catchment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-[#e67e22] bg-[#e67e22]/20" />
            <span>Community Catchment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-gray-500 bg-gray-500/10" />
            <span>Draft / Unsaved</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-red-500 bg-red-500/10" />
            <span>Invalid Geometry</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-slate-900 bg-slate-900/20" />
            <span>Selected Polygon</span>
          </div>
        </div>
      </div>

      {historyOwner && (
        <section className="rounded-lg border bg-card p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold">Boundary history: {historyOwner.name}</h4>
              <p className="text-muted-foreground">Every approved, rejected, replaced, and draft geometry is retained for audit and comparison.</p>
            </div>
            <div className="flex gap-2">
              {historyRows.length > 1 && <button type="button" onClick={compareLatestVersions} className="rounded border px-3 py-1.5">Compare latest versions</button>}
              <button type="button" onClick={() => { setHistoryOwner(null); setComparison(null); }} className="rounded border px-3 py-1.5">Close</button>
            </div>
          </div>
          {historyBusy ? (
            <p className="mt-3">Loading boundary history...</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead><tr className="border-b bg-muted/50 text-left"><th className="p-2">Version</th><th className="p-2">Status</th><th className="p-2">Change</th><th className="p-2">Reason</th><th className="p-2">Area</th><th className="p-2">Population</th><th className="p-2">Date</th><th className="p-2">Actions</th></tr></thead>
                <tbody>
                  {historyRows.map((version) => (
                    <tr key={version.id} className="border-b align-top">
                      <td className="p-2 font-semibold">v{version.version}</td>
                      <td className="p-2">{version.status}{version.approvalStatus && version.approvalStatus !== version.status ? " / " + version.approvalStatus : ""}</td>
                      <td className="p-2">{version.changeType || "-"}</td>
                      <td className="max-w-[240px] p-2">{version.changeReason || "-"}</td>
                      <td className="p-2">{version.areaSqKm == null ? "-" : Number(version.areaSqKm).toFixed(2) + " km2"}</td>
                      <td className="p-2">{version.populationEstimate?.toLocaleString() ?? "-"}</td>
                      <td className="p-2">{version.createdAt ? new Date(version.createdAt).toLocaleDateString() : "-"}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {(version.status === "draft" || version.status === "needs_correction") && <button type="button" onClick={() => lifecycleVersionAction(version, "submit")} className="rounded border px-2 py-1">Submit</button>}
                          {version.status === "submitted_for_review" && canApprovePolygon && <button type="button" onClick={() => lifecycleVersionAction(version, "approve")} className="rounded border border-green-300 px-2 py-1 text-green-700">Approve</button>}
                          {version.status === "submitted_for_review" && canApprovePolygon && <button type="button" onClick={() => lifecycleVersionAction(version, "reject")} className="rounded border border-red-300 px-2 py-1 text-red-700">Reject</button>}
                          {version.status === "draft" && canDeleteDraft && <button type="button" onClick={() => lifecycleVersionAction(version, "delete")} className="rounded border px-2 py-1">Delete draft</button>}
                          {version.status !== "draft" && version.status !== "archived" && canArchivePolygon && <button type="button" onClick={() => lifecycleVersionAction(version, "archive")} className="rounded border px-2 py-1">Archive</button>}
                          {canRecalculatePopulation && <button type="button" onClick={() => lifecycleVersionAction(version, "recalculate-population")} className="rounded border px-2 py-1">Recalculate population</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyRows.length === 0 && <p className="p-3 text-muted-foreground">No version history is available yet.</p>}
            </div>
          )}
          {comparison && (
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
              <div className="h-[300px] overflow-hidden rounded border">
                <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
                  <BasemapTileLayer basemap={basemap} />
                  {comparison.from?.geometry && <GeoJSON data={comparison.from.geometry} style={{ color: "#64748b", weight: 3, fillOpacity: 0.08 }} />}
                  {comparison.to?.geometry && <GeoJSON data={comparison.to.geometry} style={{ color: "#0f9f6e", weight: 3, fillOpacity: 0.14 }} />}
                </MapContainer>
              </div>
              <div className="rounded border p-3">
                <h5 className="font-semibold">Change impact</h5>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between"><dt>Area change</dt><dd>{Number(comparison.comparison?.areaDifferenceSqKm || 0).toFixed(2)} km2</dd></div>
                  <div className="flex justify-between"><dt>Population change</dt><dd>{Number(comparison.comparison?.populationDifference || 0).toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt>Communities</dt><dd>{comparison.impact?.communities ?? 0}</dd></div>
                  <div className="flex justify-between"><dt>Microplans</dt><dd>{comparison.impact?.microplans ?? 0}</dd></div>
                  <div className="flex justify-between"><dt>Reports</dt><dd>{comparison.impact?.reports ?? 0}</dd></div>
                  <div className="flex justify-between"><dt>Sessions</dt><dd>{comparison.impact?.sessionPlans ?? 0}</dd></div>
                </dl>
              </div>
            </div>
          )}
        </section>
      )}
      <PolygonIntelligenceCard data={intelligenceData} />

      {/* -- Population balance panel -- */}
      {catchment && (
        <div className="rounded-lg border bg-card p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Population Coverage Balance</span>
            <span className={`font-bold tabular-nums ${balancePct >= 90 ? "text-green-600" : balancePct >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {communityPopSum.toLocaleString()} / {catchmentPop.toLocaleString()}
              {" "}({balancePct}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full transition-all duration-500 ${balancePct >= 90 ? "bg-green-500" : balancePct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${balancePct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {communityPolygons.length} of {communities.length} community polygons drawn -{" "}
            {catchmentPop > communityPopSum
              ? `~${(catchmentPop - communityPopSum).toLocaleString()} people not yet attributed to a community`
              : communityPolygons.length > 0
                ? "Done All catchment population attributed to communities"
                : "Draw community polygons to attribute population"}
          </p>
        </div>
      )}

      {/* -- Community checklist -- */}
      {communities.length > 0 && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Community Coverage - {communityPolygons.length}/{communities.length} polygons drawn
          </h4>
          <div className="flex flex-wrap gap-2">
            {communities.map((c, i) => {
              const poly = communityPolygons.find((p) => p.communityName === c.name);
              return (
                <button key={i} type="button"
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    poly ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                         : "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
                  }`}
                  onClick={() => setSelectedCommunity(c.name)}>
                  {poly ? <span style={{ color: poly.color }}>mapped</span> : <span>not mapped</span>}
                  {c.name}
                  {poly?.griddedPopulation ? ` (${poly.griddedPopulation.toLocaleString()})` : ""}
                  {poly?.saved ? " Done" : poly ? " mapped" : ""}
                </button>
              );
            })}
          </div>

          {/* Extraction results */}
          {extractResult && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-2.5 text-xs space-y-1">
              <p className="font-semibold text-sky-700">
                 {extractResult.counts.villages + extractResult.counts.settlements + extractResult.counts.unmapped} places found inside catchment
              </p>
              <div className="flex flex-wrap gap-3 text-sky-600">
                <span>Saved {extractResult.counts.villages} registered villages</span>
                <span> {extractResult.counts.settlements} settlements</span>
                <span> {extractResult.counts.unmapped} unmapped OSM places</span>
              </div>
              {extractResult.unmapped.length > 0 && (
                <p className="text-[11px] text-sky-500 italic">
                  Unmapped: {extractResult.unmapped.slice(0, 8).map((u) => u.name).join(", ")}
                  {extractResult.unmapped.length > 8 ? ` +${extractResult.unmapped.length - 8} more` : ""}
                </p>
              )}
            </div>
          )}

          {/* Coverage gaps warning */}
          {uncovered.length > 0 && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-2.5">
              <div>
                <p className="text-xs font-semibold text-red-700">
                  Warning: {uncovered.length} communities without polygons - coverage gap
                </p>
                <p className="mt-0.5 text-[11px] text-red-600">
                  {uncovered.slice(0, 5).map((c) => c.name).join(", ")}
                  {uncovered.length > 5 ? ` +${uncovered.length - 5} more` : ""}
                </p>
              </div>
              <button type="button" onClick={flagUncovered}
                className="shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
                 Flag to District
              </button>
            </div>
          )}
          {uncovered.length === 0 && communityPolygons.length === communities.length && communities.length > 0 && (
            <p className="text-xs font-medium text-green-700">Saved All communities have polygons - no coverage gaps!</p>
          )}
        </div>
      )}
    </div>
  );
}
