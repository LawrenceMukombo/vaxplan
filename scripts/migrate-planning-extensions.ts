import pg from "pg";
import { readFile } from "node:fs/promises";

// Explicit local rollout only. Default is a transactional dry run.
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new Error("This rollout helper is restricted to a local database. Apply reviewed migrations through the deployment process for other environments.");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL lock_timeout='5s'");
    await connection.query("SET LOCAL statement_timeout='30s'");
    for (const file of ["planning-actions-additive.sql", "planning-evidence-additive.sql", "red-microplanning-additive.sql"]) {
      const sql = (await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"))
        .replace(/^BEGIN;\s*$/gm, "").replace(/^COMMIT;\s*$/gm, "");
      await connection.query(sql);
    }
    const apply = process.argv.includes("--apply");
    await connection.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(apply ? "Additive planning tables created. Existing records unchanged." : "Planning migration dry run passed and was rolled back.");
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
