import { describe, expect, it } from "vitest";
import { unauthenticatedCanonicalPath } from "../urlPrivacy";

describe("unauthenticatedCanonicalPath", () => {
  it("hides protected page addresses", () => {
    expect(unauthenticatedCanonicalPath("/facilities/28922")).toBe("/login");
    expect(unauthenticatedCanonicalPath("/microplans/42")).toBe("/login");
  });

  it("keeps only canonical public paths", () => {
    expect(unauthenticatedCanonicalPath("/")).toBe("/");
    expect(unauthenticatedCanonicalPath("/landing")).toBe("/");
    expect(unauthenticatedCanonicalPath("/signup")).toBe("/signup");
  });
});

