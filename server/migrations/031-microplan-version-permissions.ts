import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { tenants, userPermissions, userRoles } from "@shared/schema";
import { ROLE_PERMISSIONS } from "@shared/permissions";

const permissions = [
  { code: "microplan.view_history", name: "View Microplan History", description: "View immutable microplan lifecycle versions." },
  { code: "microplan.compare_versions", name: "Compare Microplan Versions", description: "Compare two microplan snapshots." },
  { code: "microplan.return_for_correction", name: "Return Microplans", description: "Return a submitted microplan to its author for correction." },
  { code: "microplan.restore_version", name: "Restore Microplan Versions", description: "Restore a historical microplan snapshot as a new draft." },
  { code: "microplan.rebaseline", name: "Rebaseline Microplans", description: "Create a controlled new baseline from an approved microplan." },
  { code: "microplan.view_audit", name: "View Microplan Audit", description: "View microplan version and workflow audit evidence." },
  { code: "microplan.export_version", name: "Export Microplan Versions", description: "Export a selected immutable microplan version." },
] as const;

function merge(existing: unknown, defaults: string[]) {
  return Array.from(new Set([...(Array.isArray(existing) ? existing.map(String) : []), ...defaults]));
}

export async function upsertMicroplanVersionPermissionsForAllTenants(db: NodePgDatabase<any>): Promise<void> {
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  for (const tenant of tenantRows) {
    for (const permission of permissions) {
      const [current] = await db.select({ id: userPermissions.id }).from(userPermissions)
        .where(and(eq(userPermissions.tenantId, tenant.id), eq(userPermissions.code, permission.code))).limit(1);
      if (current) {
        await db.update(userPermissions).set({ name: permission.name, description: permission.description, updatedAt: new Date() })
          .where(eq(userPermissions.id, current.id));
      } else {
        await db.insert(userPermissions).values({ tenantId: tenant.id, ...permission });
      }
    }

    for (const [code, defaults] of Object.entries(ROLE_PERMISSIONS)) {
      const [role] = await db.select().from(userRoles)
        .where(and(eq(userRoles.tenantId, tenant.id), eq(userRoles.code, code))).limit(1);
      if (!role) continue;
      await db.update(userRoles).set({ permissions: merge(role.permissions, defaults), updatedAt: new Date() })
        .where(eq(userRoles.id, role.id));
    }
  }
}
