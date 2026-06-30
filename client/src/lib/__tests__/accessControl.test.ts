import { describe, expect, it } from "vitest";
import { canAccessClientLogbook, canAccessDefaulterList, canAccessDropoutRates } from "../accessControl";

const userWithRole = (role: string, roles?: string[]) => ({ role, roles }) as any;

describe("accessControl", () => {
  it("blocks district staff from client and defaulter workspaces", () => {
    const districtUser = userWithRole("district_manager");

    expect(canAccessClientLogbook(districtUser)).toBe(false);
    expect(canAccessDefaulterList(districtUser)).toBe(false);
    expect(canAccessDropoutRates(districtUser)).toBe(true);
  });

  it("allows facility users to use client and dropout workspaces", () => {
    const facilityUser = userWithRole("facility_clerk");

    expect(canAccessClientLogbook(facilityUser)).toBe(true);
    expect(canAccessDefaulterList(facilityUser)).toBe(true);
    expect(canAccessDropoutRates(facilityUser)).toBe(true);
  });

  it("honors secondary district partner roles", () => {
    const partner = userWithRole("facility_partner", ["district_partner"]);

    expect(canAccessClientLogbook(partner)).toBe(false);
    expect(canAccessDefaulterList(partner)).toBe(false);
  });
});