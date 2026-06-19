const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query("SELECT id, code, name, category, stock_managed, active FROM catalogue_vaccines");
  console.log(res.rows);
  await pool.end();
}
run().catch(console.error);
