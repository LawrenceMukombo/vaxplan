import { describe, it, expect } from "vitest";
import { createMapLibreStyle, isMapLibreSupported } from "../maplibreStyles";
import type { StyleSpecification } from "maplibre-gl";

describe("MapLibre Styles Specification", () => {
  it("generates a valid StyleSpecification for VaxPlan Light", () => {
    const style = createMapLibreStyle("vaxplan_light") as StyleSpecification;
    expect(style).toBeDefined();
    expect(style.version).toBe(8);
    expect(style.sources).toBeDefined();
    expect(style.sources["vaxplan-basemap-source"]).toBeDefined();
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0].type).toBe("raster");
  });

  it("generates a valid StyleSpecification for VaxPlan Streets", () => {
    const style = createMapLibreStyle("vaxplan_streets") as StyleSpecification;
    expect(style.version).toBe(8);
    expect(style.name).toBe("VaxPlan Streets");
  });

  it("generates a valid StyleSpecification for Satellite", () => {
    const style = createMapLibreStyle("satellite") as StyleSpecification;
    expect(style.version).toBe(8);
    expect(style.name).toBe("Satellite Imagery");
  });

  it("handles legacy aliases transparently", () => {
    const style = createMapLibreStyle("positron") as StyleSpecification;
    expect(style.name).toBe("VaxPlan Light");
  });

  it("handles isMapLibreSupported check", () => {
    const supported = isMapLibreSupported();
    expect(typeof supported).toBe("boolean");
  });
});
