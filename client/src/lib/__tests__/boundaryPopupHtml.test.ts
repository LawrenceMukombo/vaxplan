import { describe, expect, it } from "vitest";
import { buildBoundaryPopupInfoHtml } from "../boundaryPopupHtml";

describe("boundary popup HTML", () => {
  it("escapes every database-controlled label", () => {
    const attack = `<img src=x onerror=alert(1)>`;
    const html = buildBoundaryPopupInfoHtml({
      polygonName: attack, polygonPopulation: 1, pop1k: 1, pop2k: 2, pop3k: 3,
      nearestFacility: { name: attack, distance: 1 }, nearestPlan: { name: attack, distance: 2 },
      nearbyVillages: [{ name: attack, population: 3, distance: 4 }], isHTR: false,
    }, 1, 2);
    expect(html).not.toContain(attack);
    expect(html.match(/&lt;img/g)).toHaveLength(4);
  });
});

