import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tenants, userPermissions, userRoles } from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/permissions";

const polygonPermissions = [
  { code: "polygon.view", name: "View Polygons", description: "View official and draft polygons within assigned scope." },
  { code: "polygon.create", name: "Create Polygons", description: "Create draft polygons within assigned scope." },
  { code: "polygon.edit", name: "Edit Polygons", description: "Create versioned polygon corrections within assigned scope." },
  { code: "polygon.delete_draft", name: "Delete Unused Draft Polygons", description: "Permanently delete drafts that have never become active." },
  { code: "polygon.archive", name: "Archive Polygons", description: "Archive inactive polygon versions while preserving history." },
  { code: "polygon.replace", name: "Replace Polygons", description: "Propose replacement geometry as a new version." },
  { code: "polygon.approve", name: "Approve Polygon Changes", description: "Approve or return submitted polygon versions for correction." },
  { code: "polygon.override_validation", name: "Override Polygon Warnings", description: "Approve configured polygon warnings with a recorded reason." },
  { code: "polygon.view_history", name: "View Polygon History", description: "View prior and proposed polygon versions." },
  { code: "polygon.compare_versions", name: "Compare Polygon Versions", description: "Compare geometry, area, population, and planning impact." },
  { code: "polygon.recalculate_population", name: "Recalculate Polygon Population", description: "Recalculate population for a polygon version from configured sources." },
] as const;

const managedRoleCodes = [
  "facility_clerk",
  "facility_in_charge",
  "district_manager",
  "provincial_coordinator",
  "gis_specialist",
  "national_admin",
] as const;

function mergePermissions(existing: unknown, defaults: string[]): string[] {
  const current = Array.isArray(existing) ? existing.map(String) : [];
  return Array.from(new Set([...current, ...defaults]));
}

export async function upsertPolygonPermissionsForAllTenants(db: NodePgDatabase<any>): Promise<void> {
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);

  for (const tenant of tenantRows) {
    for (const permission of polygonPermissions) {
      const [existing] = await db.select({ id: userPermissions.id })
        .from(userPermissions)
        .where(and(eq(userPermissions.tenantId, tenant.id), eq(userPermissions.code, permission.code)))
        .limit(1);

      if (existing) {
        await db.update(userPermissions)
          .set({ name: permission.name, description: permission.description, updatedAt: new Date() })
          .where(eq(userPermissions.id, existing.id));
      } else {
        await db.insert(userPermissions).values({ tenantId: tenant.id, ...permission });
      }
    }

    for (const roleCode of managedRoleCodes) {
      const defaults = ROLE_PERMISSIONS[roleCode] || [];
      const [existingRole] = await db.select()
        .from(userRoles)
        .where(and(eq(userRoles.tenantId, tenant.id), eq(userRoles.code, roleCode)))
        .limit(1);
      const permissions = mergePermissions(existingRole?.permissions, defaults);

      if (existingRole) {
        await db.update(userRoles)
          .set({ permissions, updatedAt: new Date() })
          .where(eq(userRoles.id, existingRole.id));
      } else {
        await db.insert(userRoles).values({
          tenantId: tenant.id,
          code: roleCode,
          name: roleCode.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
          permissions,
        });
      }
    }
  }
}
