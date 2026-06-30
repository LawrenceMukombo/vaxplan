import type { User } from "@shared/schema";

type UserWithEffectivePermissions = User & { effectivePermissions?: string[] };

const PERMISSION_ALIASES: Record<string, string[]> = {
  manage_users: [
    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",
    "users.reset_password",
    "users.assign_roles",
    "users.assign_permissions",
    "roles.view",
    "roles.create",
    "roles.update",
    "roles.delete",
    "roles.assign_permissions",
    "permissions.view",
    "permissions.assign",
  ],
  view_clients: ["client_logbook.view"],
  create_client: ["client_logbook.create"],
  edit_client: ["client_logbook.update"],
  view_reports: ["dashboard.view", "dropout_rates.view"],
};

function expandPermission(target: Set<string>, permission: string): void {
  target.add(permission);
  (PERMISSION_ALIASES[permission] || []).forEach((alias) => target.add(alias));
}

function userRoles(user: User | null | undefined): string[] {
  if (!user) return [];
  const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
  return [user.role, ...roles].filter(Boolean).map(String);
}

export function isNationalAdmin(user: User | null | undefined): boolean {
  return userRoles(user).includes("national_admin") || (user as any)?.isPlatformAdmin === true;
}

export function permissionsForUser(user: User | null | undefined): Set<string> {
  const permissions = new Set<string>();
  if (!user) return permissions;
  if ((user as any).isPlatformAdmin === true) permissions.add("*");
  const effective = (user as UserWithEffectivePermissions).effectivePermissions;
  const raw: string[] = Array.isArray(effective) ? effective : Array.isArray((user as any).permissions) ? (user as any).permissions : [];
  raw.map(String).forEach((permission) => expandPermission(permissions, permission));
  return permissions;
}

export function hasAnyPermission(user: User | null | undefined, permissions: string[]): boolean {
  if (!user) return false;
  if (isNationalAdmin(user)) return true;
  const effective = permissionsForUser(user);
  return effective.has("*") || permissions.some((permission) => effective.has(permission));
}

export function canAccessUserManagement(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["users.view", "users.create", "users.update", "manage_users"]);
}

export function canAccessRoleManagement(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["roles.view", "users.assign_roles", "manage_users"]);
}

export function canAccessPermissionManagement(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["permissions.view", "users.assign_permissions", "manage_users"]);
}

export function canAccessClientLogbook(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["client_logbook.view", "view_clients"]);
}

export function canAccessDefaulterList(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["defaulter_list.view"]);
}

export function canAccessDropoutRates(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["dropout_rates.view", "view_reports"]);
}
