import { TileLayer } from "react-leaflet";
import { Map, Sun, Compass, Satellite, Mountain, Globe, Moon, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistedBasemap, type Basemap } from "@/hooks/usePersistedBasemap";
import {
  CARTO_POSITRON_ATTRIBUTION,
  CARTO_VOYAGER_ATTRIBUTION,
} from "@/data/dataSources";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export { usePersistedBasemap };
export type { Basemap };

/* Original BASEMAP_CONFIGS commented out for backward-compatibility and to specify zoom bounds:
export const BASEMAP_CONFIGS: Record<
  Basemap,
  { name: string; url: string; attribution: string; maxNativeZoom?: number; maxZoom?: number }
> = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  positron: {
    name: "CARTO Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_POSITRON_ATTRIBUTION,
  },
  voyager: {
    name: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: CARTO_VOYAGER_ATTRIBUTION,
    maxNativeZoom: 17,
    maxZoom: 22,
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxNativeZoom: 17,
    maxZoom: 22,
  },
  carto: {
    name: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: CARTO_VOYAGER_ATTRIBUTION,
    maxNativeZoom: 17,
    maxZoom: 22,
  },
  terrain: {
    name: "Terrain Map",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, <a href='http://viewfinderpanoramas.org'>SRTM</a> | Map style: &copy; <a href='https://opentopomap.org'>OpenTopoMap</a> (<a href='https://creativecommons.org/licenses/by-sa/3.0/'>CC-BY-SA</a>)",
  },
  humanitarian: {
    name: "Humanitarian Map",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, Tiles style by <a href='https://www.hotosm.org/'>Humanitarian OpenStreetMap Team</a> hosted by <a href='https://openstreetmap.fr/'>OSM France</a>",
  },
  dark: {
    name: "Dark Mode Map",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    name: "Light Mode Map",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_POSITRON_ATTRIBUTION,
  },
  boundary: {
    name: "Administrative Boundaries",
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution: CARTO_POSITRON_ATTRIBUTION,
  },
};
*/

// Updated BASEMAP_CONFIGS: specifies maxZoom (22) and maxNativeZoom for all basemaps
const cartoApiKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_CARTO_API_KEY) ? `?api_key=${import.meta.env.VITE_CARTO_API_KEY}` : "";

// Configs with maxNativeZoom and maxZoom set explicitly
// so Leaflet can stretch tiles at close zooms (up to zoom 22) instead of failing to render.
export const BASEMAP_CONFIGS: Record<
  Basemap,
  { name: string; url: string; attribution: string; maxNativeZoom?: number; maxZoom?: number }
> = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 22,
  },
  positron: {
    name: "Clean Light Canvas",
    url: cartoApiKey 
      ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: cartoApiKey 
      ? CARTO_POSITRON_ATTRIBUTION 
      : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxNativeZoom: 18,
    maxZoom: 22,
  },
  voyager: {
    name: "OpenStreetMap Voyager",
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: cartoApiKey ? CARTO_VOYAGER_ATTRIBUTION : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 22,
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxNativeZoom: 17,
    maxZoom: 22,
  },
  carto: {
    name: "CARTO Voyager",
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: cartoApiKey ? CARTO_VOYAGER_ATTRIBUTION : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom: 22,
  },
  terrain: {
    name: "Terrain Map",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, <a href='http://viewfinderpanoramas.org'>SRTM</a> | Map style: &copy; <a href='https://opentopomap.org'>OpenTopoMap</a> (<a href='https://creativecommons.org/licenses/by-sa/3.0/'>CC-BY-SA</a>)",
    maxNativeZoom: 17,
    maxZoom: 22,
  },
  humanitarian: {
    name: "Humanitarian Map",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, Tiles style by <a href='https://www.hotosm.org/'>Humanitarian OpenStreetMap Team</a> hosted by <a href='https://openstreetmap.fr/'>OSM France</a>",
    maxNativeZoom: 19,
    maxZoom: 22,
  },
  dark: {
    name: "Dark Mode Map",
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: cartoApiKey ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxNativeZoom: 18,
    maxZoom: 22,
  },
  light: {
    name: "Light Mode Map",
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: cartoApiKey ? CARTO_POSITRON_ATTRIBUTION : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxNativeZoom: 18,
    maxZoom: 22,
  },
  boundary: {
    name: "Administrative Boundaries",
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png${cartoApiKey}`
      : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: cartoApiKey ? CARTO_POSITRON_ATTRIBUTION : "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxNativeZoom: 18,
    maxZoom: 22,
  },
};

export const BASEMAP_ITEMS = [
  { key: "osm", label: "OpenStreetMap", icon: Map },
  { key: "positron", label: "CARTO Positron (Light)", icon: Sun },
  { key: "voyager", label: "CARTO Voyager (Color)", icon: Compass },
  { key: "satellite", label: "Satellite Imagery", icon: Satellite },
  { key: "terrain", label: "Terrain Map", icon: Mountain },
  { key: "humanitarian", label: "Humanitarian Map", icon: Globe },
  { key: "dark", label: "Dark Mode Map", icon: Moon },
  { key: "boundary", label: "Administrative Boundaries", icon: Globe },
] as const;

export function BasemapTileLayer({ basemap }: { basemap: Basemap }) {
  const config = BASEMAP_CONFIGS[basemap] || BASEMAP_CONFIGS.positron;
  return (
    <TileLayer
      key={basemap}
      attribution={config.attribution}
      url={config.url}
      maxNativeZoom={config.maxNativeZoom}
      maxZoom={config.maxZoom}
    />
  );
}

/**
 * Floating basemap switcher control using a dropdown menu.
 * Render INSIDE a relatively-positioned map wrapper (the same div that contains <MapContainer />)
 */
export function BasemapSwitcher({
  basemap,
  onChange,
  className,
}: {
  basemap: Basemap;
  onChange: (b: Basemap) => void;
  className?: string;
}) {
  const current = BASEMAP_ITEMS.find((i) => i.key === basemap) || BASEMAP_ITEMS[1];
  const Icon = current.icon;

  return (
    <div
      className={cn("absolute top-3 right-3 z-[1000]", className)}
      role="group"
      aria-label="Basemap"
      data-testid="basemap-switcher"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-card hover:bg-secondary text-foreground flex items-center gap-1.5 shadow-md border-border h-8 font-semibold text-xs"
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Basemap: {current.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-[1001]"
        >
          {BASEMAP_ITEMS.map((item) => {
            const ItemIcon = item.icon;
            const active = basemap === item.key;
            return (
              <DropdownMenuItem
                key={item.key}
                onClick={() => onChange(item.key as Basemap)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
                data-testid={`basemap-${item.key}`}
              >
                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
