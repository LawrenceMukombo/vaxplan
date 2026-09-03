import { TileLayer } from "react-leaflet";
import { Map, Sun, Compass, Satellite, Mountain, Globe, Moon, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistedBasemap, type Basemap } from "@/hooks/usePersistedBasemap";
import {
  BASEMAP_REGISTRY,
  getBasemapProvider,
  getEnabledBasemapProviders,
  type BasemapProvider,
} from "@/lib/gis/basemapRegistry";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export { usePersistedBasemap };
export type { Basemap };

const ICON_MAP = {
  sun: Sun,
  compass: Compass,
  moon: Moon,
  satellite: Satellite,
  mountain: Mountain,
  map: Map,
  layers: Layers,
} as const;

function getIconForProvider(provider: BasemapProvider) {
  if (provider.iconHint && ICON_MAP[provider.iconHint]) {
    return ICON_MAP[provider.iconHint];
  }
  switch (provider.type) {
    case "light":
      return Sun;
    case "streets":
      return Compass;
    case "dark":
      return Moon;
    case "satellite":
      return Satellite;
    case "terrain":
      return Mountain;
    default:
      return Map;
  }
}

/**
 * Universal configuration dictionary mapping every known key (modern and legacy)
 * to its tile URL, attribution, and zoom thresholds.
 */
export const BASEMAP_CONFIGS: Record<
  string,
  { name: string; url: string; attribution: string; maxNativeZoom?: number; maxZoom?: number }
> = new Proxy(
  {},
  {
    get(_target, propKey: string) {
      const provider = getBasemapProvider(propKey);
      return {
        name: provider.displayName,
        url: provider.tileUrl,
        attribution: provider.attribution,
        maxNativeZoom: provider.maxNativeZoom,
        maxZoom: provider.maxZoom,
      };
    },
  },
);

/**
 * Legacy list of items for backward compatibility with existing components.
 * Driven directly by enabled providers in the registry.
 */
export const BASEMAP_ITEMS = getEnabledBasemapProviders().map((p) => ({
  key: p.id as Basemap,
  label: p.displayName,
  icon: getIconForProvider(p),
  badge: p.badge,
}));

/**
 * Renders the active Leaflet tile layer based on the selected basemap.
 */
export function BasemapTileLayer({ basemap }: { basemap: Basemap }) {
  const provider = getBasemapProvider(basemap);
  return (
    <TileLayer
      key={provider.id}
      attribution={provider.attribution}
      url={provider.tileUrl}
      maxNativeZoom={provider.maxNativeZoom}
      maxZoom={provider.maxZoom}
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
  const currentProvider = getBasemapProvider(basemap);
  const CurrentIcon = getIconForProvider(currentProvider);
  const enabledProviders = getEnabledBasemapProviders();

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
            <span>Basemap: {currentProvider.displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-xl z-[1001]"
        >
          {enabledProviders.map((item) => {
            const ItemIcon = getIconForProvider(item);
            const active =
              basemap === item.id ||
              getBasemapProvider(basemap).id === item.id;
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => onChange(item.id as Basemap)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
                data-testid={`basemap-${item.id}`}
              >
                <div className="flex items-center gap-2">
                  <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.displayName}</span>
                </div>
                {item.badge && !active && (
                  <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                    {item.badge}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
