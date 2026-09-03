import { useCallback, useEffect, useState } from "react";
import {
  BASEMAP_REGISTRY,
  LEGACY_BASEMAP_ALIAS_MAP,
  getBasemapProvider,
  isBasemapMissingApiKey,
} from "@/lib/gis/basemapRegistry";

export type Basemap =
  | "vaxplan_light"
  | "vaxplan_streets"
  | "vaxplan_dark"
  | "openstreetmap"
  | "satellite"
  | "terrain"
  | "humanitarian"
  | "carto_positron"
  | "carto_voyager"
  | "positron"
  | "voyager"
  | "osm"
  | "carto"
  | "dark"
  | "light"
  | "boundary";

const STORAGE_KEY = "vaxplan.basemap";

const KNOWN_BASEMAP_KEYS = new Set([
  ...Object.keys(BASEMAP_REGISTRY),
  ...Object.keys(LEGACY_BASEMAP_ALIAS_MAP),
]);

function readStored(): Basemap | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v || !KNOWN_BASEMAP_KEYS.has(v)) return null;
    const provider = getBasemapProvider(v);
    if (isBasemapMissingApiKey(provider)) {
      return "vaxplan_light";
    }
    return v as Basemap;
  } catch {
    return null;
  }
}

export function usePersistedBasemap(defaultValue: Basemap = "vaxplan_light") {
  const [basemap, setBasemapState] = useState<Basemap>(
    () => readStored() ?? defaultValue,
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, basemap);
    } catch {
      // ignore (e.g. private mode / storage disabled)
    }
  }, [basemap]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue && KNOWN_BASEMAP_KEYS.has(e.newValue)) {
        setBasemapState(e.newValue as Basemap);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setBasemap = useCallback<
    React.Dispatch<React.SetStateAction<Basemap>>
  >((value) => {
    setBasemapState((prev) =>
      typeof value === "function" ? (value as (p: Basemap) => Basemap)(prev) : value,
    );
  }, []);

  return [basemap, setBasemap] as const;
}
