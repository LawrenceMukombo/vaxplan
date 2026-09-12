import { pool } from "../db";

/**
 * One-time, idempotent policy migration from the former 21-day default to the
 * new 7-day default. A marker prevents later administrator choices (including
 * changing the value back to 21) from being overwritten on restart.
 */
export async function applyMinimumPlanDevelopmentDaysMigration() {
  await pool.query(`
    UPDATE tenants
    SET settings = jsonb_set(
      jsonb_set(COALESCE(settings, '{}'::jsonb), '{minimumPlanDevelopmentDays}', '7'::jsonb, true),
      '{minimumPlanDevelopmentDaysSevenDayMigration}', 'true'::jsonb, true
    )
    WHERE COALESCE((settings->>'minimumPlanDevelopmentDaysSevenDayMigration')::boolean, false) = false
      AND (settings->>'minimumPlanDevelopmentDays' IS NULL OR settings->>'minimumPlanDevelopmentDays' = '21')
  `);
}
