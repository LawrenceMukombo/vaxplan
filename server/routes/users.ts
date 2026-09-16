import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { storage } from "../storage";
import { insertUserRoleSchema, userPermissions } from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/permissions";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { refreshTenantRolesCache } from "../auth/authorization";
import {
  logAudit,
  getGeoScope,
  recordInGeoScope,
  requireAnyPermission,
  userCanAccessGeo,
  userHasAccessToUser,
  canAssignRequestedRoles,
  hasDirectPermissionAssignmentAccess,
  requestedPermissionsChanged,
  SYSTEM_USER_PERMISSIONS,
  invalidateGeoScopeCache,
} from "../routes";

export const usersRouter = Router();
export const userRolesRouter = Router();
export const userPermissionsRouter = Router();

// ─── USER ACCESS MANAGEMENT ENDPOINTS (/api/users) ─────────────────────────

// GET /api/users with geographic scoping
usersRouter.get("/", isAuthenticated, requireTenant, requireAnyPermission(["users.view", "manage_users"]), async (req: any, res) => {
  try {
    const list = await storage.listUsers(req.tenantId);
    const scope = await getGeoScope(req.dbUser!, req.tenantId);
    if (scope.all) {
      return res.json(list);
    }

    const filtered = list.filter((u: any) => {
      if (u.isPlatformAdmin) return false;

      const targetGeo = {
        facilityId: u.facilityId,
        districtId: u.districtId,
        provinceId: u.provinceId,
      };
      if (recordInGeoScope(scope, targetGeo)) return true;

      const tScope = u.dataAccessScope || {};
      const tFacs = Array.isArray(tScope.facilities) ? tScope.facilities.map(Number) : [];
      const tDists = Array.isArray(tScope.districts) ? tScope.districts.map(Number) : [];
      const tProvs = Array.isArray(tScope.provinces) ? tScope.provinces.map(Number) : [];

      for (const fid of tFacs) {
        if (scope.facilityIds.has(fid)) return true;
      }
      for (const did of tDists) {
        if (scope.districtIds.has(did)) return true;
      }
      for (const pid of tProvs) {
        if (scope.provinceIds.has(pid)) return true;
      }

      return false;
    });
    res.json(filtered);
  } catch (err: any) {
    console.error("GET /api/users failed:", err);
    res.status(500).json({ message: "Failed to list users" });
  }
});

// PUT /api/users/:id/roles-permissions with geographic check on target and dataAccessScope
usersRouter.put("/:id/roles-permissions", isAuthenticated, requireTenant, requireAnyPermission(["users.assign_roles", "users.assign_permissions", "manage_users"]), async (req: any, res) => {
  try {
    const { roles, permissions, dataAccessScope } = req.body;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ message: "roles must be a string array" });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "permissions must be a string array" });
    }
    if (!dataAccessScope || typeof dataAccessScope !== "object") {
      return res.status(400).json({ message: "dataAccessScope must be a geographic scope object" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser || targetUser.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!(await userHasAccessToUser(req.dbUser!, targetUser, req.tenantId))) {
      return res.status(403).json({ message: "Forbidden: no management access to this user context" });
    }
    if (!canAssignRequestedRoles(req.dbUser!, roles)) {
      return res.status(403).json({ message: "Forbidden: cannot assign roles above your delegation level" });
    }
    if (requestedPermissionsChanged(permissions, targetUser.permissions) && !hasDirectPermissionAssignmentAccess(req.dbUser!)) {
      return res.status(403).json({ message: "Forbidden: direct permission assignment requires explicit permission assignment access" });
    }

    // Check explicit scopes in dataAccessScope
    const tFacs = Array.isArray(dataAccessScope.facilities) ? dataAccessScope.facilities.map(Number) : [];
    const tDists = Array.isArray(dataAccessScope.districts) ? dataAccessScope.districts.map(Number) : [];
    const tProvs = Array.isArray(dataAccessScope.provinces) ? dataAccessScope.provinces.map(Number) : [];

    for (const fid of tFacs) {
      if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { facilityId: fid }))) {
        return res.status(403).json({ message: "Forbidden: target facility scope is outside your access scope" });
      }
    }
    for (const did of tDists) {
      if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { districtId: did }))) {
        return res.status(403).json({ message: "Forbidden: target district scope is outside your access scope" });
      }
    }
    for (const pid of tProvs) {
      if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { provinceId: pid }))) {
        return res.status(403).json({ message: "Forbidden: target province scope is outside your access scope" });
      }
    }

    const updatedUser = await storage.updateUserRolesAndPermissions(
      req.tenantId,
      req.params.id,
      roles,
      permissions,
      dataAccessScope
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await logAudit(req, "update_user_access", "users", null, null, {
      userId: req.params.id,
      roles,
      permissions,
      dataAccessScope,
    });

    res.json(updatedUser);
  } catch (err: any) {
    console.error("PUT /api/users/:id/roles-permissions failed:", err);
    res.status(500).json({ message: "Failed to update user access parameters" });
  }
});

// POST /api/users with geographic check on target location parameters and dataAccessScope
usersRouter.post("/", isAuthenticated, requireTenant, requireAnyPermission(["users.create", "manage_users"]), async (req: any, res) => {
  try {
    const { email, firstName, lastName, roles, dataAccessScope, isActive, facilityId, districtId, provinceId } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const existing = await storage.getUserByEmailAndTenant(email, req.tenantId);
    if (existing) {
      return res.status(400).json({ message: "A user with this email address already exists" });
    }

    const targetGeo = { facilityId, districtId, provinceId };
    if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, targetGeo))) {
      return res.status(403).json({ message: "Forbidden: cannot create a user outside your assigned geographic scope" });
    }
    if (!canAssignRequestedRoles(req.dbUser!, roles || ["facility_clerk"])) {
      return res.status(403).json({ message: "Forbidden: cannot assign roles above your delegation level" });
    }

    if (dataAccessScope) {
      const tFacs = Array.isArray(dataAccessScope.facilities) ? dataAccessScope.facilities.map(Number) : [];
      const tDists = Array.isArray(dataAccessScope.districts) ? dataAccessScope.districts.map(Number) : [];
      const tProvs = Array.isArray(dataAccessScope.provinces) ? dataAccessScope.provinces.map(Number) : [];

      for (const fid of tFacs) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { facilityId: fid }))) {
          return res.status(403).json({ message: "Forbidden: dataAccessScope contains facility outside your scope" });
        }
      }
      for (const did of tDists) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { districtId: did }))) {
          return res.status(403).json({ message: "Forbidden: dataAccessScope contains district outside your scope" });
        }
      }
      for (const pid of tProvs) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { provinceId: pid }))) {
          return res.status(403).json({ message: "Forbidden: dataAccessScope contains province outside your scope" });
        }
      }
    }

    const user = await storage.createUser(req.tenantId, {
      email,
      firstName,
      lastName,
      roles: roles || ["facility_clerk"],
      dataAccessScope: dataAccessScope || { provinces: [], districts: [], facilities: [] },
      isActive: isActive !== undefined ? isActive : true,
      facilityId: facilityId || null,
      districtId: districtId || null,
      provinceId: provinceId || null,
    });
    await logAudit(req, "create_user", "users", user.id, null, user);
    res.status(201).json(user);
  } catch (err: any) {
    console.error("POST /api/users failed:", err);
    res.status(500).json({ message: "Failed to create user account" });
  }
});

// PATCH /api/users/:id with geographic check on target and body params
usersRouter.patch("/:id", isAuthenticated, requireTenant, requireAnyPermission(["users.update", "manage_users"]), async (req: any, res) => {
  try {
    const { firstName, lastName, email, roles, permissions, dataAccessScope, isActive, facilityId, districtId, provinceId } = req.body;
    const oldUser = await storage.getUser(req.params.id);
    if (!oldUser || oldUser.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!(await userHasAccessToUser(req.dbUser!, oldUser, req.tenantId))) {
      return res.status(403).json({ message: "Forbidden: no management access to this user context" });
    }

    if (facilityId !== undefined || districtId !== undefined || provinceId !== undefined) {
      const newTargetGeo = {
        facilityId: facilityId === undefined ? oldUser.facilityId : facilityId,
        districtId: districtId === undefined ? oldUser.districtId : districtId,
        provinceId: provinceId === undefined ? oldUser.provinceId : provinceId,
      };
      if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, newTargetGeo))) {
        return res.status(403).json({ message: "Forbidden: cannot relocate user to a geographic area outside your scope" });
      }
    }

    if (roles && !canAssignRequestedRoles(req.dbUser!, roles)) {
      return res.status(403).json({ message: "Forbidden: cannot assign roles above your delegation level" });
    }
    if (requestedPermissionsChanged(permissions, oldUser.permissions) && !hasDirectPermissionAssignmentAccess(req.dbUser!)) {
      return res.status(403).json({ message: "Forbidden: direct permission assignment requires explicit permission assignment access" });
    }

    if (dataAccessScope) {
      const tFacs = Array.isArray(dataAccessScope.facilities) ? dataAccessScope.facilities.map(Number) : [];
      const tDists = Array.isArray(dataAccessScope.districts) ? dataAccessScope.districts.map(Number) : [];
      const tProvs = Array.isArray(dataAccessScope.provinces) ? dataAccessScope.provinces.map(Number) : [];

      for (const fid of tFacs) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { facilityId: fid }))) {
          return res.status(403).json({ message: "Forbidden: target facility scope is outside your access scope" });
        }
      }
      for (const did of tDists) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { districtId: did }))) {
          return res.status(403).json({ message: "Forbidden: target district scope is outside your access scope" });
        }
      }
      for (const pid of tProvs) {
        if (!(await userCanAccessGeo(req.dbUser!, req.tenantId, { provinceId: pid }))) {
          return res.status(403).json({ message: "Forbidden: target province scope is outside your access scope" });
        }
      }
    }

    const updated = await storage.updateUser(req.tenantId, req.params.id, {
      firstName,
      lastName,
      email,
      roles,
      permissions,
      dataAccessScope,
      isActive,
      facilityId: facilityId === undefined ? oldUser.facilityId : (facilityId || null),
      districtId: districtId === undefined ? oldUser.districtId : (districtId || null),
      provinceId: provinceId === undefined ? oldUser.provinceId : (provinceId || null),
    });
    await logAudit(req, "update_user", "users", req.params.id, oldUser, updated);
    invalidateGeoScopeCache(req.params.id, req.tenantId);
    res.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/users/:id failed:", err);
    res.status(500).json({ message: "Failed to update user details" });
  }
});

// DELETE /api/users/:id with geographic check on target
usersRouter.delete("/:id", isAuthenticated, requireTenant, requireAnyPermission(["users.deactivate", "manage_users"]), async (req: any, res) => {
  try {
    const oldUser = await storage.getUser(req.params.id);
    if (!oldUser || oldUser.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!(await userHasAccessToUser(req.dbUser!, oldUser, req.tenantId))) {
      return res.status(403).json({ message: "Forbidden: no management access to this user context" });
    }
    await storage.deleteUser(req.tenantId, req.params.id);
    await logAudit(req, "delete_user", "users", req.params.id, oldUser, null);
    invalidateGeoScopeCache(req.params.id, req.tenantId);
    res.status(204).send();
  } catch (err: any) {
    console.error("DELETE /api/users/:id failed:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Grant or revoke platform Super-Admin (cross-country access + switching)
usersRouter.post("/:id/platform-admin", isAuthenticated, async (req: any, res) => {
  try {
    if (req.dbUser?.isPlatformAdmin !== true) {
      return res.status(403).json({ message: "Only a Super Admin can manage Super Admins." });
    }
    const { isPlatformAdmin } = z
      .object({ isPlatformAdmin: z.boolean() })
      .parse(req.body);

    const target = await storage.getUser(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!isPlatformAdmin && target.id === req.dbUser.id) {
      return res
        .status(400)
        .json({ message: "You cannot remove your own Super Admin access." });
    }

    const updated = await storage.setPlatformAdmin(target.id, isPlatformAdmin);
    await logAudit(
      req,
      isPlatformAdmin ? "grant_platform_admin" : "revoke_platform_admin",
      "users",
      target.id,
      { isPlatformAdmin: target.isPlatformAdmin },
      { isPlatformAdmin },
    );
    res.json(updated ?? { id: target.id, isPlatformAdmin });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", errors: err.errors });
    }
    console.error("POST /api/users/:id/platform-admin failed:", err);
    res.status(500).json({ message: "Failed to update Super Admin access" });
  }
});

// ─── CUSTOM USER ROLES CRUD ENDPOINTS (/api/user-roles) ────────────────────

userRolesRouter.get("/", isAuthenticated, requireTenant, requireAnyPermission(["roles.view", "users.assign_roles", "manage_users"]), async (req: any, res) => {
  try {
    let roles = await storage.getUserRoles(req.tenantId);
    if (roles.length === 0) {
      for (const [code, perms] of Object.entries(ROLE_PERMISSIONS)) {
        await storage.createUserRole(req.tenantId, {
          code,
          name: code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          permissions: perms,
        });
      }
      roles = await storage.getUserRoles(req.tenantId);
    }
    res.json(roles);
  } catch (err: any) {
    console.error("GET /api/user-roles failed:", err);
    res.status(500).json({ message: "Failed to fetch user roles" });
  }
});

userRolesRouter.post("/", isAuthenticated, requireTenant, requireAnyPermission(["roles.create", "manage_users"]), async (req: any, res) => {
  try {
    const data = insertUserRoleSchema.parse(req.body) as any;

    const existing = await storage.getUserRoleByCode(req.tenantId, data.code);
    if (existing) {
      return res.status(400).json({ message: `A user role with code ${data.code} already exists.` });
    }

    const role = await storage.createUserRole(req.tenantId, data);
    await refreshTenantRolesCache(req.tenantId);
    await logAudit(req, "create_user_role", "user_roles", role.id, null, role);
    res.status(201).json(role);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid user role data", errors: err.errors });
    }
    console.error("POST /api/user-roles failed:", err);
    res.status(500).json({ message: "Failed to create user role" });
  }
});

userRolesRouter.patch("/:id", isAuthenticated, requireTenant, requireAnyPermission(["roles.update", "roles.assign_permissions", "manage_users"]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const oldRole = await storage.getUserRole(req.tenantId, id);
    if (!oldRole) {
      return res.status(404).json({ message: "User role not found" });
    }

    const data = req.body;
    const updated = await storage.updateUserRole(req.tenantId, id, data);
    await refreshTenantRolesCache(req.tenantId);
    invalidateGeoScopeCache(null, req.tenantId);
    await logAudit(req, "update_user_role", "user_roles", id, oldRole, updated);
    res.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/user-roles/:id failed:", err);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

userRolesRouter.delete("/:id", isAuthenticated, requireTenant, requireAnyPermission(["roles.delete", "manage_users"]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const oldRole = await storage.getUserRole(req.tenantId, id);
    if (!oldRole) {
      return res.status(404).json({ message: "User role not found" });
    }

    if (oldRole.code === "national_admin") {
      return res.status(400).json({ message: "The super admin role 'national_admin' is a critical platform dependency and cannot be deleted." });
    }

    await storage.deleteUserRole(req.tenantId, id);
    await refreshTenantRolesCache(req.tenantId);
    await logAudit(req, "delete_user_role", "user_roles", id, oldRole, null);
    res.status(204).send();
  } catch (err: any) {
    console.error("DELETE /api/user-roles/:id failed:", err);
    res.status(500).json({ message: "Failed to delete user role" });
  }
});

// ─── CUSTOM USER PERMISSIONS CRUD ENDPOINTS (/api/user-permissions) ─────────

userPermissionsRouter.get("/", isAuthenticated, requireTenant, requireAnyPermission(["permissions.view", "roles.view", "users.assign_permissions", "manage_users"]), async (req: any, res) => {
  try {
    for (const permission of SYSTEM_USER_PERMISSIONS) {
      await db
        .insert(userPermissions)
        .values({
          tenantId: req.tenantId,
          code: permission.code.toLowerCase(),
          name: permission.name,
          description: permission.description,
        })
        .onConflictDoUpdate({
          target: [userPermissions.tenantId, userPermissions.code],
          set: {
            name: permission.name,
            description: permission.description,
            updatedAt: new Date(),
          },
        });
    }

    const permissions = await storage.getUserPermissions(req.tenantId);
    res.json(permissions);
  } catch (err: any) {
    console.error("GET /api/user-permissions failed:", err);
    res.status(500).json({ message: "Failed to fetch user permissions" });
  }
});

userPermissionsRouter.post("/", isAuthenticated, requireTenant, requireAnyPermission(["permissions.assign", "manage_users"]), async (req: any, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ message: "Permission code and name are required." });
    }

    const existing = await storage.getUserPermissionByCode(req.tenantId, code);
    if (existing) {
      return res.status(400).json({ message: `A user permission with code ${code} already exists.` });
    }

    const perm = await storage.createUserPermission(req.tenantId, { code, name, description });
    await logAudit(req, "create_user_permission", "user_permissions", perm.id, null, perm);
    res.status(201).json(perm);
  } catch (err: any) {
    console.error("POST /api/user-permissions failed:", err);
    res.status(500).json({ message: "Failed to create user permission" });
  }
});

userPermissionsRouter.patch("/:id", isAuthenticated, requireTenant, requireAnyPermission(["permissions.assign", "manage_users"]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const oldPerm = await storage.getUserPermission(req.tenantId, id);
    if (!oldPerm) {
      return res.status(404).json({ message: "User permission not found" });
    }

    const { name, description } = req.body;
    const updated = await storage.updateUserPermission(req.tenantId, id, { name, description });
    await logAudit(req, "update_user_permission", "user_permissions", id, oldPerm, updated);
    res.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/user-permissions/:id failed:", err);
    res.status(500).json({ message: "Failed to update user permission" });
  }
});

userPermissionsRouter.delete("/:id", isAuthenticated, requireTenant, requireAnyPermission(["permissions.assign", "manage_users"]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const oldPerm = await storage.getUserPermission(req.tenantId, id);
    if (!oldPerm) {
      return res.status(404).json({ message: "User permission not found" });
    }

    const SYSTEM_CODES = ["manage_users", "view_reports", "edit_microplans", "plan_sessions", "execute_sessions", "manage_stock", "conduct_supervision"];
    if (SYSTEM_CODES.includes(oldPerm.code.toLowerCase())) {
      return res.status(400).json({ message: `The system permission '${oldPerm.code}' is a critical platform dependency and cannot be deleted.` });
    }

    await storage.deleteUserPermission(req.tenantId, id);
    await logAudit(req, "delete_user_permission", "user_permissions", id, oldPerm, null);
    res.status(204).send();
  } catch (err: any) {
    console.error("DELETE /api/user-permissions/:id failed:", err);
    res.status(500).json({ message: "Failed to delete user permission" });
  }
});

export function registerUserManagementRoutes(app: any) {
  app.use("/api/users", usersRouter);
  app.use("/api/user-roles", userRolesRouter);
  app.use("/api/user-permissions", userPermissionsRouter);
}

export default usersRouter;
