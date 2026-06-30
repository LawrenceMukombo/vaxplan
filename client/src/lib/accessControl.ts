import type { User } from "@shared/schema";

const DISTRICT_STAFF_ROLES = new Set(["district_manager", "district_partner"]);

function userRoles(user: User | null | undefined): string[] {
  if (!user) return [];
  const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
  return [user.role, ...roles].filter(Boolean).map(String);
}

export function isDistrictStaff(user: User | null | undefined): boolean {
  return userRoles(user).some((role) => DISTRICT_STAFF_ROLES.has(role));
}

export function canAccessClientLogbook(user: User | null | undefined): boolean {
  return !!user && !isDistrictStaff(user);
}

export function canAccessDefaulterList(user: User | null | undefined): boolean {
  return !!user && !isDistrictStaff(user);
}

export function canAccessDropoutRates(user: User | null | undefined): boolean {
  return !!user;
}