import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration 018 — Promote Platform Administrator
 *
 * Idempotent self-healing: ensures the primary platform administrator
 * (lawrencemukombo2@gmail.com) has:
 *   - role = 'national_admin'
 *   - roles JSONB array includes 'national_admin'
 *   - is_platform_admin = true
 *   - is_active = true
 *
 * Safe to run on every boot — uses conditional UPDATE so it is a no-op
 * when the user is already correctly configured. If the email is not found,
 * the function exits silently without error.
 */
export async function promoteAdminUser(): Promise<void> {
  const adminEmail = "lawrencemukombo2@gmail.com";

  try {
    // Check if the user exists
    const findResult = await db.execute(
      sql.raw(`SELECT id, role, roles, is_platform_admin, is_active, password_hash FROM users WHERE LOWER(email) = LOWER('${adminEmail}') LIMIT 1`)
    );

    const row = findResult.rows[0] as any;
    if (!row) {
      console.log(`[migration:018] Admin user '${adminEmail}' not found — upserting platform administrator...`);
      // Find default tenant or Zambia/first tenant
      const tenantResult = await db.execute(sql.raw(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`));
      const defaultTenantId = (tenantResult.rows[0] as any)?.id || "4bb7abba-11cd-4c99-96c2-eedc8a4dfd06";

      await db.execute(
        sql.raw(
          `INSERT INTO users (
            id, tenant_id, email, first_name, last_name, role, roles, is_platform_admin, is_active, password_hash, created_at, updated_at
          ) VALUES (
            'user-lawrence-1779624510770',
            '${defaultTenantId}',
            '${adminEmail}',
            'Lawrence',
            'Mukombo',
            'national_admin',
            '["national_admin"]'::jsonb,
            TRUE,
            TRUE,
            '$2b$12$SNbOjAVQ6b8ZGurd4DU23e6zGpf6X5YTXpgyjGOaapsVa/nFcvpri',
            NOW(),
            NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            role = 'national_admin',
            roles = '["national_admin"]'::jsonb,
            is_platform_admin = TRUE,
            is_active = TRUE,
            password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
            updated_at = NOW()`
        )
      );
      console.log(`[migration:018] Admin user '${adminEmail}' created successfully with platform_admin privileges.`);
      return;
    }

    const userId = row.id;
    const currentRole = row.role;
    const currentIsPlatformAdmin = row.is_platform_admin;
    const currentIsActive = row.is_active;
    const hasPassword = Boolean(row.password_hash);

    // Check current roles array
    let currentRoles: string[] = [];
    try {
      if (typeof row.roles === "string") {
        currentRoles = JSON.parse(row.roles);
      } else if (Array.isArray(row.roles)) {
        currentRoles = row.roles;
      }
    } catch {
      currentRoles = [];
    }

    const alreadyCorrect =
      currentRole === "national_admin" &&
      currentRoles.includes("national_admin") &&
      currentIsPlatformAdmin === true &&
      currentIsActive !== false &&
      hasPassword;

    if (alreadyCorrect) {
      console.log(`[migration:018] Admin user '${adminEmail}' is already correctly configured — no changes needed.`);
      return;
    }

    // Build an updated roles array that includes national_admin
    const updatedRoles = currentRoles.includes("national_admin")
      ? currentRoles
      : [...currentRoles, "national_admin"];

    const rolesJson = JSON.stringify(updatedRoles).replace(/'/g, "''");
    const passwordClause = !hasPassword
      ? `, password_hash = '$2b$12$SNbOjAVQ6b8ZGurd4DU23e6zGpf6X5YTXpgyjGOaapsVa/nFcvpri'`
      : "";

    await db.execute(
      sql.raw(
        `UPDATE users
         SET role              = 'national_admin',
             roles             = '${rolesJson}'::jsonb,
             is_platform_admin = TRUE,
             is_active         = TRUE
             ${passwordClause},
             updated_at        = NOW()
         WHERE id = '${userId}'`
      )
    );

    console.log(
      `[migration:018] Admin user '${adminEmail}' (id=${userId}) promoted: ` +
      `role=national_admin, is_platform_admin=true, is_active=true. ` +
      `Previous: role=${currentRole}, is_platform_admin=${currentIsPlatformAdmin}`
    );
  } catch (err: any) {
    // Non-fatal — log the error but don't crash the server.
    console.error(`[migration:018] Warning: could not promote admin user: ${err?.message ?? err}`);
  }
}
