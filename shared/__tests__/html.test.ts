import { describe, expect, it } from "vitest";
import { escapeHtml } from "../html";

describe("escapeHtml", () => {
  it("neutralizes executable markup and quoted attributes", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });

  it("handles nullish values without emitting literal null or undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

