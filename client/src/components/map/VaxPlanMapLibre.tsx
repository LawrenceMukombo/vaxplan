import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  Popup,
  type MapMouseEvent,
  type FitBoundsOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Basemap } from "@/hooks/usePersistedBasemap";
import { createMapLibreStyle, isMapLibreSupported } from "@/lib/gis/maplibreStyles";
import {
  facilitiesToGeoJSON,
  villagesToGeoJSON,
  sessionsToGeoJSON,
  unservedPlacesToGeoJSON,
  createPointLayersForSource,
  createClusteredGeoJSONSource,
  handleClusterClick,
  type GeoPointFeatureProperties,
} from "@/lib/gis/maplibreLayers";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VaxPlanMapLayersVisibility {
  facilities?: boolean;
  villages?: boolean;
  sessions?: boolean;
  unserved?: boolean;
}

export interface VaxPlanMapLibreProps {
  /** Map center as [latitude, longitude] to match Leaflet convention */
  center?: [number, number];
  /** Initial or controlled zoom level */
  zoom?: number;
  /** Active basemap identifier */
  basemap?: Basemap;
  /** Operational facilities dataset */
  facilities?: any[];
  /** Operational communities/villages dataset */
  villages?: any[];
  /** Operational session pins dataset */
  sessions?: any[];
  /** Unserved places dataset */
  unservedPlaces?: any[];
  /** Set of village IDs that have planned immunisation sessions */
  plannedVillageIds?: Set<number>;
  /** Layer visibility controls */
  layersVisibility?: VaxPlanMapLayersVisibility;
  /** Callback fired when zoom level finishes changing */
  onZoomChange?: (zoom: number) => void;
  /** Callback fired when viewport bounds change (returns { west, south, east, north }) */
  onBoundsChange?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  /** Callback fired when user clicks the map canvas */
  onClick?: (coords: { lat: number; lng: number }, event: MapMouseEvent) => void;
  /** Callback fired when a specific operational feature is clicked */
  onFeatureClick?: (feature: GeoPointFeatureProperties) => void;
  /** CSS class applied to map container */
  className?: string;
  /** CSS inline style */
  style?: React.CSSProperties;
  /** Whether to show standard navigation controls (zoom, compass, pitch) */
  showNavigationControls?: boolean;
  /** Minimum zoom limit */
  minZoom?: number;
  /** Maximum zoom limit */
  maxZoom?: number;
  /** Optional children overlays */
  children?: React.ReactNode;
}

export interface VaxPlanMapLibreRef {
  getMap: () => MapLibreMap | null;
  flyTo: (center: [number, number], zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: FitBoundsOptions) => void;
}

const DEFAULT_LAYERS: VaxPlanMapLayersVisibility = {
  facilities: true,
  villages: true,
  sessions: true,
  unserved: true,
};

export const VaxPlanMapLibre = forwardRef<VaxPlanMapLibreRef, VaxPlanMapLibreProps>(
  function VaxPlanMapLibre(
    {
      center = [-6.0, 147.0],
      zoom = 6,
      basemap = "vaxplan_light",
      facilities = [],
      villages = [],
      sessions = [],
      unservedPlaces = [],
      plannedVillageIds = new Set<number>(),
      layersVisibility = DEFAULT_LAYERS,
      onZoomChange,
      onBoundsChange,
      onClick,
      onFeatureClick,
      className = "w-full h-full relative",
      style,
      showNavigationControls = true,
      minZoom = 1,
      maxZoom = 22,
      children,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const activePopupRef = useRef<Popup | null>(null);
    const [isWebGLSupported] = useState(() => isMapLibreSupported());
    const [contextLost, setContextLost] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Keep track of current props with refs to prevent loopbacks
    const prevCenterRef = useRef<[number, number]>(center);
    const prevZoomRef = useRef<number>(zoom);
    const prevBasemapRef = useRef<Basemap>(basemap);

    // Expose imperative API for smooth programmatic panning and fitting bounds
    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
      flyTo: (newCenter: [number, number], newZoom?: number) => {
        if (!mapRef.current) return;
        mapRef.current.flyTo({
          center: [newCenter[1], newCenter[0]], // Convert [lat, lng] to [lng, lat]
          zoom: newZoom !== undefined ? newZoom : mapRef.current.getZoom(),
          essential: true,
        });
      },
      fitBounds: (bounds: [[number, number], [number, number]], options?: FitBoundsOptions) => {
        if (!mapRef.current) return;
        const maplibreBounds: [number, number, number, number] = [
          bounds[0][1],
          bounds[0][0],
          bounds[1][1],
          bounds[1][0],
        ];
        mapRef.current.fitBounds(maplibreBounds, options);
      },
    }));

    // Helper: Mount or update GPU operational vector sources and layers
    const setupOperationalLayers = (map: MapLibreMap) => {
      // 1. Facilities
      const facilitiesGeo = facilitiesToGeoJSON(facilities);
      if (!map.getSource("vaxplan-facilities")) {
        map.addSource("vaxplan-facilities", createClusteredGeoJSONSource(facilitiesGeo, 14, 50));
        const layers = createPointLayersForSource("vaxplan-facilities", "vaxplan-facilities", "#2563eb");
        layers.forEach((l) => map.addLayer(l));
      } else {
        (map.getSource("vaxplan-facilities") as any).setData(facilitiesGeo);
      }

      // 2. Communities / Villages
      const villagesGeo = villagesToGeoJSON(villages, plannedVillageIds);
      if (!map.getSource("vaxplan-villages")) {
        map.addSource("vaxplan-villages", createClusteredGeoJSONSource(villagesGeo, 15, 40));
        const layers = createPointLayersForSource("vaxplan-villages", "vaxplan-villages", "#10b981");
        layers.forEach((l) => map.addLayer(l));
      } else {
        (map.getSource("vaxplan-villages") as any).setData(villagesGeo);
      }

      // 3. Immunization Sessions
      const sessionsGeo = sessionsToGeoJSON(sessions);
      if (!map.getSource("vaxplan-sessions")) {
        map.addSource("vaxplan-sessions", createClusteredGeoJSONSource(sessionsGeo, 15, 35));
        const layers = createPointLayersForSource("vaxplan-sessions", "vaxplan-sessions", "#4f46e5");
        layers.forEach((l) => map.addLayer(l));
      } else {
        (map.getSource("vaxplan-sessions") as any).setData(sessionsGeo);
      }

      // 4. Unserved Places
      const unservedGeo = unservedPlacesToGeoJSON(unservedPlaces);
      if (!map.getSource("vaxplan-unserved")) {
        map.addSource("vaxplan-unserved", createClusteredGeoJSONSource(unservedGeo, 15, 45));
        const layers = createPointLayersForSource("vaxplan-unserved", "vaxplan-unserved", "#dc2626");
        layers.forEach((l) => map.addLayer(l));
      } else {
        (map.getSource("vaxplan-unserved") as any).setData(unservedGeo);
      }

      // Wire interactive event handlers
      const interactivePointLayers = [
        "vaxplan-facilities-points",
        "vaxplan-villages-points",
        "vaxplan-sessions-points",
        "vaxplan-unserved-points",
      ];

      const clusterLayers = [
        "vaxplan-facilities-clusters",
        "vaxplan-villages-clusters",
        "vaxplan-sessions-clusters",
        "vaxplan-unserved-clusters",
      ];

      // Cluster clicks
      clusterLayers.forEach((layerId) => {
        const sourceId = layerId.replace("-clusters", "");
        map.on("click", layerId, (e) => {
          handleClusterClick(map, sourceId, e);
        });
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      });

      // Individual point clicks
      interactivePointLayers.forEach((layerId) => {
        map.on("click", layerId, (e) => {
          if (!e.features || !e.features.length) return;
          const feat = e.features[0];
          const props = feat.properties as any;
          const coords = (feat.geometry as any).coordinates.slice();

          onFeatureClick?.(props);

          // Render sleek MapLibre popup
          activePopupRef.current?.remove();
          const popupHtml = `
            <div style="padding: 6px 8px; font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">${props.name || "Feature"}</div>
              <div style="color: #64748b; text-transform: capitalize;">${props.type || "Point"} ${props.facilityType ? `• ${props.facilityType}` : ""}</div>
              ${props.status ? `<div style="color: #2563eb; font-weight: 600; margin-top: 4px;">Status: ${props.status}</div>` : ""}
              ${props.totalPopulation ? `<div style="color: #059669; margin-top: 2px;">Pop: ~${Number(props.totalPopulation).toLocaleString()}</div>` : ""}
            </div>
          `;
          activePopupRef.current = new Popup({ offset: 12, closeButton: false })
            .setLngLat(coords)
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      });
    };

    // Initialize MapLibre instance
    useEffect(() => {
      if (!isWebGLSupported || !containerRef.current) return;

      const initialStyle = createMapLibreStyle(basemap);
      const [lat, lng] = center;

      const map = new MapLibreMap({
        container: containerRef.current,
        style: initialStyle,
        center: [lng, lat],
        zoom,
        minZoom,
        maxZoom,
        attributionControl: false,
      });

      mapRef.current = map;

      if (showNavigationControls) {
        map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      }

      map.addControl(new AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        setIsMapLoaded(true);
        setupOperationalLayers(map);

        if (onBoundsChange) {
          const b = map.getBounds();
          onBoundsChange({
            west: b.getWest(),
            south: b.getSouth(),
            east: b.getEast(),
            north: b.getNorth(),
          });
        }
      });

      // When style changes (e.g. basemap switch), reload operational layers
      map.on("style.load", () => {
        setupOperationalLayers(map);
      });

      map.on("zoomend", () => {
        const z = map.getZoom();
        prevZoomRef.current = z;
        onZoomChange?.(z);
      });

      map.on("moveend", () => {
        const c = map.getCenter();
        prevCenterRef.current = [c.lat, c.lng];
        if (onBoundsChange) {
          const b = map.getBounds();
          onBoundsChange({
            west: b.getWest(),
            south: b.getSouth(),
            east: b.getEast(),
            north: b.getNorth(),
          });
        }
      });

      map.on("click", (e: MapMouseEvent) => {
        onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, e);
      });

      // WebGL context handling
      const canvas = map.getCanvas();
      const onContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const onContextRestored = () => {
        setContextLost(false);
        map.setStyle(createMapLibreStyle(basemap));
      };

      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.addEventListener("webglcontextrestored", onContextRestored);

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        activePopupRef.current?.remove();
        resizeObserver.disconnect();
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        map.remove();
        mapRef.current = null;
        setIsMapLoaded(false);
      };
    }, [isWebGLSupported]);

    // Update dynamic datasets when props change
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isMapLoaded) return;
      setupOperationalLayers(map);
    }, [facilities, villages, sessions, unservedPlaces, plannedVillageIds, isMapLoaded]);

    // Update layer visibility
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isMapLoaded) return;

      const toggleLayer = (layerIds: string[], visible: boolean) => {
        layerIds.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
          }
        });
      };

      toggleLayer(
        ["vaxplan-facilities-clusters", "vaxplan-facilities-cluster-count", "vaxplan-facilities-points"],
        layersVisibility.facilities !== false,
      );
      toggleLayer(
        ["vaxplan-villages-clusters", "vaxplan-villages-cluster-count", "vaxplan-villages-points"],
        layersVisibility.villages !== false,
      );
      toggleLayer(
        ["vaxplan-sessions-clusters", "vaxplan-sessions-cluster-count", "vaxplan-sessions-points"],
        layersVisibility.sessions !== false,
      );
      toggleLayer(
        ["vaxplan-unserved-clusters", "vaxplan-unserved-cluster-count", "vaxplan-unserved-points"],
        layersVisibility.unserved !== false,
      );
    }, [layersVisibility, isMapLoaded]);

    // Update style dynamically when basemap changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isMapLoaded) return;

      if (prevBasemapRef.current !== basemap) {
        prevBasemapRef.current = basemap;
        const newStyle = createMapLibreStyle(basemap);
        map.setStyle(newStyle);
      }
    }, [basemap, isMapLoaded]);

    // Update center and zoom if changed externally
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isMapLoaded) return;

      const [lat, lng] = center;
      const prevCenter = prevCenterRef.current;
      const prevZoom = prevZoomRef.current;

      const centerChanged = Math.abs(prevCenter[0] - lat) > 0.0001 || Math.abs(prevCenter[1] - lng) > 0.0001;
      const zoomChanged = Math.abs(prevZoom - zoom) > 0.1;

      if (centerChanged || zoomChanged) {
        prevCenterRef.current = [lat, lng];
        prevZoomRef.current = zoom;
        map.easeTo({
          center: [lng, lat],
          zoom,
          duration: 300,
        });
      }
    }, [center, zoom, isMapLoaded]);

    if (!isWebGLSupported) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 p-6 text-center border rounded-xl">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
          <h3 className="text-base font-semibold text-foreground">WebGL Acceleration Unavailable</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Your browser or device does not currently have WebGL hardware acceleration enabled.
          </p>
        </div>
      );
    }

    return (
      <div className={className} style={style}>
        <div ref={containerRef} className="w-full h-full select-none" />
        {contextLost && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-rose-500 mb-2 animate-bounce" />
            <p className="text-sm font-bold text-foreground">Graphics Context Temporarily Paused</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">The GPU was reset by the operating system.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.setStyle(createMapLibreStyle(basemap));
                  setContextLost(false);
                }
              }}
              className="gap-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restore Map View
            </Button>
          </div>
        )}
        {children}
      </div>
    );
  },
);
