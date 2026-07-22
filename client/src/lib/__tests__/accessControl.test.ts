import { describe, expect, it } from "vitest";
import {
  canAccessAdministration,
  canAccessClientLogbook,
  canAccessDefaulterList,
  canAccessDropoutRates,
  canAccessHisIntegrations,
  canAccessSessionPlanning,
  canAccessUserManagement,
  canPlanSessions,
  hasAnyPermission,
} from "../accessControl";

const userWithPermissions = (permissions: string[], role = "district_manager") => ({ role, permissions, effectivePermissions: permissions }) as any;

describe("accessControl", () => {
  it("uses effective permissions instead of hardcoded district role denial", () => {
    const districtUser = userWithPermissions(["users.view", "users.create"]);

    expect(canAccessUserManagement(districtUser)).toBe(true);
    expect(canAccessAdministration(districtUser)).toBe(true);
    expect(hasAnyPermission(districtUser, ["users.create"])).toBe(true);
  });

  it("keeps client and defaulter workspaces permission driven", () => {
    const districtUser = userWithPermissions([]);

    expect(canAccessClientLogbook(districtUser)).toBe(false);
    expect(canAccessDefaulterList(districtUser)).toBe(false);
    expect(canAccessDropoutRates(districtUser)).toBe(false);
  });

  it("moves HIS integrations under permission-driven administration", () => {
    const hisViewer = userWithPermissions(["his_integrations.view"]);
    const regularDistrictUser = userWithPermissions([]);

    expect(canAccessAdministration(hisViewer)).toBe(true);
    expect(canAccessHisIntegrations(hisViewer)).toBe(true);
    expect(canAccessAdministration(regularDistrictUser)).toBe(false);
    expect(canAccessHisIntegrations(regularDistrictUser)).toBe(false);
  });

  it("separates session viewing from session planning", () => {
    const viewer = userWithPermissions(["sessions.view"]);
    const planner = userWithPermissions(["sessions.plan"]);

    expect(canAccessSessionPlanning(viewer)).toBe(true);
    expect(canPlanSessions(viewer)).toBe(false);
    expect(canAccessSessionPlanning(planner)).toBe(true);
    expect(canPlanSessions(planner)).toBe(true);
  });

  it("honors legacy permission aliases for backwards compatibility", () => {
    const legacyUser = userWithPermissions(["manage_users", "view_clients", "view_reports", "manage_session_plans"], "facility_clerk");

    expect(canAccessUserManagement(legacyUser)).toBe(true);
    expect(canAccessClientLogbook(legacyUser)).toBe(true);
    expect(canAccessDropoutRates(legacyUser)).toBe(true);
    expect(canPlanSessions(legacyUser)).toBe(true);
  });
});