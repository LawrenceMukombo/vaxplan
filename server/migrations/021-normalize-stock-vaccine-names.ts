/**
 * Migration 021 — normalize_stock_vaccine_names
 *
 * Normalizes any legacy dose-level names (e.g. 'PENTA-1', 'MR-2', 'OPV-0')
 * in the stock_transactions table to vaccine product codes ('PENTA', 'MR', 'OPV').
 *
 * Safe to re-run: idempotent.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function up(db: NodePgDatabase<any>): Promise<void> {
  await db.execute(sql`
    UPDATE stock_transactions
    SET vaccine_name = CASE 
      WHEN UPPER(TRIM(vaccine_name)) IN ('OPV-0', 'OPV-1', 'OPV-2', 'OPV-3') THEN 'OPV'
      WHEN UPPER(TRIM(vaccine_name)) IN ('IPV-1', 'IPV-2') THEN 'IPV'
      WHEN UPPER(TRIM(vaccine_name)) IN ('PCV-1', 'PCV-2', 'PCV-3') THEN 'PCV'
      WHEN UPPER(TRIM(vaccine_name)) IN ('PENTA-1', 'PENTA-2', 'PENTA-3') THEN 'PENTA'
      WHEN UPPER(TRIM(vaccine_name)) IN ('ROTA-1', 'ROTA-2', 'ROTA') THEN 'ROTAVIRUS'
      WHEN UPPER(TRIM(vaccine_name)) IN ('MR-1', 'MR-2') THEN 'MR'
      WHEN UPPER(TRIM(vaccine_name)) IN ('TT-1', 'TT-2') THEN 'TT'
      ELSE vaccine_name
    END
    WHERE UPPER(TRIM(vaccine_name)) IN (
      'OPV-0', 'OPV-1', 'OPV-2', 'OPV-3',
      'IPV-1', 'IPV-2',
      'PCV-1', 'PCV-2', 'PCV-3',
      'PENTA-1', 'PENTA-2', 'PENTA-3',
      'ROTA-1', 'ROTA-2', 'ROTA',
      'MR-1', 'MR-2',
      'TT-1', 'TT-2'
    );
  `);
}

export async function down(db: NodePgDatabase<any>): Promise<void> {
  // Lossy normalization, nothing to revert in down direction.
}
