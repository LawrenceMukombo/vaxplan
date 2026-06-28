import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyStockLedgerColumnsMigration(db: NodePgDatabase<any>): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE client_vaccinations 
      ADD COLUMN IF NOT EXISTS schedule_dose_id integer,
      ADD COLUMN IF NOT EXISTS stock_transaction_id integer;
    `);
    await db.execute(sql`
      ALTER TABLE stock_transactions 
      ADD COLUMN IF NOT EXISTS balance_before integer,
      ADD COLUMN IF NOT EXISTS balance_after integer,
      ADD COLUMN IF NOT EXISTS source_module varchar(100),
      ADD COLUMN IF NOT EXISTS source_record_id varchar(100);
    `);
  } catch (err: any) {
    console.error("Migration: failed to apply stock ledger columns:", err.message);
  }
}
