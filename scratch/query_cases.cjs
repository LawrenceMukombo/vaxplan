const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function queryCases() {
  const { rows } = await pool.query('SELECT id, tenant_id, patient_name, disease, classification FROM surveillance_cases');
  console.log(`Found ${rows.length} cases.`);
  console.log(rows);
  
  const { rows: tenants } = await pool.query('SELECT id, code, name FROM tenants');
  console.log(`Tenants:`, tenants);
  
  process.exit(0);
}

queryCases();
