import type { StyleSpecification } from "maplibre-gl";
import {
  getBasemapProvider,
  type BasemapProvider,
} from "./basemapRegistry";

/**
 * Generates an authoritative MapLibre StyleSpecification for a given basemap provider.
 * If the provider specifies a vector `styleUrl`, that URL can be used directly.
 * Otherwise, this builds a clean, performant raster-source StyleSpecification.
 */
export function createMapLibreStyle(providerKeyOrObject: string | BasemapProvider): StyleSpecification | string {
  const provider = typeof providerKeyOrObject === "string"
    ? getBasemapProvider(providerKeyOrObject)
    : providerKeyOrObject;

  // If a dedicated self-hosted vector style URL is configured and available, return it directly
  if (provider.styleUrl && provider.engine === "vector") {
    return provider.styleUrl;
  }

  // Convert Leaflet-style URL template {s}.tile... to MapLibre tile URL
  // MapLibre doesn't use {s} subdomains in the same way; we expand {s} or default to a standard subdomain
  const normalizedTileUrl = provider.tileUrl
    .replace("{s}", "a")
    .replace("{r}", "");

  const style: StyleSpecification = {
    version: 8,
    name: provider.displayName,
    sources: {
      "vaxplan-basemap-source": {
        type: "raster",
        tiles: [normalizedTileUrl],
        tileSize: 256,
        attribution: provider.attribution,
        minzoom: provider.minZoom,
        maxzoom: provider.maxNativeZoom,
      },
    },
    layers: [
      {
        id: "vaxplan-basemap-layer",
        type: "raster",
        source: "vaxplan-basemap-source",
        paint: {
          "raster-opacity": 1.0,
          "raster-fade-duration": 150,
        },
      },
    ],
  };

  return style;
}

/**
 * Checks whether MapLibre GL is supported by the client browser / hardware (WebGL 1 or 2).
 */
export function isMapLibreSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
