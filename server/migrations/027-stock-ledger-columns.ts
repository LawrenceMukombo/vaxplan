import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyStockLedgerColumnsMigration(db: NodePgDatabase<any>): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE client_vaccinations 
      ADD COLUMN IF NOT EXISTS schedule_dose_id integer,
      ADD COLUMN IF NOT EXISTS stock_transaction_id integer,
      ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
    `);
    await db.execute(sql`
      ALTER TABLE stock_transactions 
      DROP CONSTRAINT IF EXISTS stock_transactions_product_id_fkey,
      DROP CONSTRAINT IF EXISTS stock_transactions_product_id_catalogue_vaccines_id_fk,
      ADD COLUMN IF NOT EXISTS balance_before integer,
      ADD COLUMN IF NOT EXISTS balance_after integer,
      ADD COLUMN IF NOT EXISTS source_module varchar(100),
      ADD COLUMN IF NOT EXISTS source_record_id varchar(100),
      ADD COLUMN IF NOT EXISTS is_void boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS void_reason text;
    `);
  } catch (err: any) {
    console.error("Migration: failed to apply stock ledger columns:", err.message);
  }
}
