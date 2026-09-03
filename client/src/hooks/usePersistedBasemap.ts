import { useCallback, useEffect, useState } from "react";

export type Basemap =
  | "positron"
  | "voyager"
  | "osm"
  | "satellite"
  | "carto"
  | "terrain"
  | "humanitarian"
  | "dark"
  | "light"
  | "boundary";

const STORAGE_KEY = "vaxplan.basemap";

const VALID_BASEMAPS = [
  "positron",
  "voyager",
  "osm",
  "satellite",
  "carto",
  "terrain",
  "humanitarian",
  "dark",
  "light",
  "boundary",
];

function readStored(): Basemap | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v || !VALID_BASEMAPS.includes(v)) return null;
    const hasCartoKey = !!import.meta.env.VITE_CARTO_API_KEY;
    if (!hasCartoKey && (v === "positron" || v === "voyager" || v === "carto" || v === "light" || v === "boundary")) {
      return "osm";
    }
    return v as Basemap;
  } catch {
    return null;
  }
}

export function usePersistedBasemap(defaultValue: Basemap = "osm") {
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
      if (e.newValue && VALID_BASEMAPS.includes(e.newValue)) {
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
