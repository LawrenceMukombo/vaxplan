import { describe, expect, it } from "vitest";
import { canAccessClientLogbook, canAccessDefaulterList, canAccessDropoutRates, canAccessUserManagement, hasAnyPermission } from "../accessControl";

const userWithPermissions = (permissions: string[], role = "district_manager") => ({ role, permissions, effectivePermissions: permissions }) as any;

describe("accessControl", () => {
  it("uses effective permissions instead of hardcoded district role denial", () => {
    const districtUser = userWithPermissions(["users.view", "users.create"]);

    expect(canAccessUserManagement(districtUser)).toBe(true);
    expect(hasAnyPermission(districtUser, ["users.create"])).toBe(true);
  });

  it("keeps client and defaulter workspaces permission driven", () => {
    const districtUser = userWithPermissions([]);

    expect(canAccessClientLogbook(districtUser)).toBe(false);
    expect(canAccessDefaulterList(districtUser)).toBe(false);
    expect(canAccessDropoutRates(districtUser)).toBe(false);
  });

  it("honors legacy permission aliases for backwards compatibility", () => {
    const legacyUser = userWithPermissions(["manage_users", "view_clients", "view_reports"], "facility_clerk");

    expect(canAccessUserManagement(legacyUser)).toBe(true);
    expect(canAccessClientLogbook(legacyUser)).toBe(true);
    expect(canAccessDropoutRates(legacyUser)).toBe(true);
  });
});
