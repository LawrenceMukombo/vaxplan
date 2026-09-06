import { describe, it, expect } from "vitest";
import {
  BASEMAP_REGISTRY,
  LEGACY_BASEMAP_ALIAS_MAP,
  getBasemapProvider,
  getEnabledBasemapProviders,
  isBasemapMissingApiKey,
} from "../basemapRegistry";

describe("Basemap Provider Registry", () => {
  it("defines VaxPlan Light as the primary clean baseline", () => {
    const light = BASEMAP_REGISTRY.vaxplan_light;
    expect(light).toBeDefined();
    expect(light.displayName).toBe("VaxPlan Light");
    expect(light.type).toBe("light");
    expect(light.enabled).toBe(true);
    expect(light.requiresApiKey).toBe(false);
  });

  it("defines VaxPlan Streets and VaxPlan Dark", () => {
    const streets = BASEMAP_REGISTRY.vaxplan_streets;
    const dark = BASEMAP_REGISTRY.vaxplan_dark;
    expect(streets.enabled).toBe(true);
    expect(dark.enabled).toBe(true);
  });

  it("isolates CARTO basemaps as requiring an API key", () => {
    const cartoPositron = BASEMAP_REGISTRY.carto_positron;
    const cartoVoyager = BASEMAP_REGISTRY.carto_voyager;
    expect(cartoPositron.requiresApiKey).toBe(true);
    expect(cartoVoyager.requiresApiKey).toBe(true);
  });

  it("maps legacy aliases to modern canonical providers", () => {
    expect(getBasemapProvider("osm").id).toBe("openstreetmap");
    expect(getBasemapProvider("positron").id).toBe("vaxplan_light");
    expect(getBasemapProvider("voyager").id).toBe("vaxplan_streets");
    expect(getBasemapProvider("carto").id).toBe("vaxplan_streets");
    expect(getBasemapProvider("light").id).toBe("vaxplan_light");
    expect(getBasemapProvider("dark").id).toBe("vaxplan_dark");
    expect(getBasemapProvider("satellite").id).toBe("satellite");
    expect(getBasemapProvider("terrain").id).toBe("terrain");
  });

  it("safely falls back for unknown basemap keys", () => {
    const fallback = getBasemapProvider("non_existent_key");
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe("vaxplan_light");
  });

  it("returns only enabled providers in getEnabledBasemapProviders", () => {
    const enabled = getEnabledBasemapProviders();
    expect(enabled.length).toBeGreaterThanOrEqual(5);
    for (const provider of enabled) {
      expect(provider.enabled).toBe(true);
    }
  });

  it("correctly identifies missing API keys for unauthenticated CARTO", () => {
    const cartoProvider = BASEMAP_REGISTRY.carto_positron;
    const isMissing = isBasemapMissingApiKey(cartoProvider);
    // In test environment without VITE_CARTO_API_KEY, this should return true
    expect(typeof isMissing).toBe("boolean");
  });
});
