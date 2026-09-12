import { db } from "../db";
import { sql } from "drizzle-orm";

export async function applyClientsColumns(): Promise<void> {
  const statements = [
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_cross_border boolean DEFAULT false`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS country_of_origin varchar(100)`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS foreign_residence text`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS border_point_of_entry varchar(100)`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp_available boolean DEFAULT false`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_app boolean DEFAULT false`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS email varchar(255)`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language varchar(50) DEFAULT 'en'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_channel varchar(50)`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_id varchar(100)`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS serial_number integer`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_year integer`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false`,
    `CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients (client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_facility_serial ON clients (facility_id, registration_year, serial_number)`,
  ];
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      console.warn(`[migration:037] client column migration warning: ${err?.message ?? err}`);
    }
  }
}
