import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyStockLedgerColumnsMigration(db: NodePgDatabase<any>): Promise<void> {
  const statements = [
    `ALTER TABLE client_vaccinations ADD COLUMN IF NOT EXISTS schedule_dose_id integer`,
    `ALTER TABLE client_vaccinations ADD COLUMN IF NOT EXISTS stock_transaction_id integer`,
    `ALTER TABLE client_vaccinations ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false`,
    `ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_product_id_fkey`,
    `ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_product_id_catalogue_vaccines_id_fk`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS balance_before integer`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS balance_after integer`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS source_module varchar(100)`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS source_record_id varchar(100)`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS is_void boolean DEFAULT false`,
    `ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS void_reason text`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`[migration:027] Executed: ${stmt}`);
    } catch (err: any) {
      console.warn(`[migration:027] Warning on statement "${stmt}": ${err.message}`);
    }
  }
}
