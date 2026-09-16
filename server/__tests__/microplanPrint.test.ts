import { describe, expect, it } from "vitest";
import { buildMicroplanPrintHtml } from "../routes/microplanPrint";

describe("microplan print HTML", () => {
  it("does not allow a title to break into HTML or script", () => {
    const attack = `</script><img src=x onerror=alert(1)>'"`;
    const html = buildMicroplanPrintHtml({ title: attack, format: "A4", latitude: 1, longitude: 2, zoom: 3 });
    expect(html).not.toContain(attack);
    expect(html).not.toContain("</script><img");
    expect(html).toContain("&lt;/script&gt;&lt;img");
    expect(html).toContain("\\u003c/script>");
  });
});

