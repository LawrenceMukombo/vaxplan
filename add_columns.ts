import { pool } from './server/db';

async function run() {
  try {
    await pool.query(`ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES catalogue_vaccines(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS product_code VARCHAR(100)`);
    console.log('Columns added successfully');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    process.exit(0);
  }
}
run();
