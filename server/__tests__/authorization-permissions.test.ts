import { beforeEach, describe, expect, it } from "vitest";
import { getEffectivePermissions, hasPermission, tenantRolesCache } from "../auth/authorization";

const baseUser = (overrides: Record<string, any> = {}) =>
  ({
    id: "user-1",
    tenantId: "tenant-1",
    role: "district_manager",
    roles: ["district_manager"],
    permissions: [],
    dataAccessScope: { provinces: [], districts: [10], facilities: [] },
    provinceId: null,
    districtId: 10,
    facilityId: null,
    isPlatformAdmin: false,
    ...overrides,
  }) as any;

describe("dynamic granular RBAC", () => {
  beforeEach(() => {
    tenantRolesCache.clear();
  });

  it("uses tenant role permissions for granular user management actions", () => {
    tenantRolesCache.set("tenant-1", {
      district_manager: ["users.view", "users.create"],
    } as any);

    const user = baseUser();

    expect(hasPermission(user, "users.view")).toBe(true);
    expect(hasPermission(user, "users.create", { districtId: 10, activeTenantId: "tenant-1" })).toBe(true);
    expect(hasPermission(user, "users.create", { districtId: 99, activeTenantId: "tenant-1" })).toBe(false);
    expect(hasPermission(user, "roles.delete")).toBe(false);
  });

  it("expands legacy permissions into granular permissions", async () => {
    const user = baseUser({ permissions: ["manage_users", "view_clients"] });

    expect(hasPermission(user, "users.assign_roles")).toBe(true);
    expect(hasPermission(user, "client_logbook.view")).toBe(true);

    const effective = await getEffectivePermissions(user, "tenant-1");
    expect(effective).toContain("manage_users");
    expect(effective).toContain("users.assign_permissions");
    expect(effective).toContain("client_logbook.view");
  });
});
