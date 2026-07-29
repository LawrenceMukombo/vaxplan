import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import pg, { type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
const inputPath = path.resolve(
  process.cwd(),
  process.argv[2] || "scratch/local_database_all.jsonl.gz",
);

type TableMeta = { name: string; columns: string[]; conflictColumns: string[] };

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const tagged = value as { $type?: string; value?: string };
    if (tagged.$type === "bytea") return Buffer.from(tagged.value || "", "base64");
    if (tagged.$type === "date") return tagged.value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

async function upsertRow(client: PoolClient, table: TableMeta, encoded: unknown) {
  const row = decode(encoded) as Record<string, unknown>;
  const columns = table.columns.filter((column) => Object.hasOwn(row, column));
  const values = columns.map((column) => row[column]);
  const columnSql = columns.map(pg.escapeIdentifier).join(", ");
  const valueSql = columns.map((_, index) => `$${index + 1}`).join(", ");
  let conflictSql = "ON CONFLICT DO NOTHING";

  if (table.conflictColumns.length) {
    const target = table.conflictColumns.map(pg.escapeIdentifier).join(", ");
    const updateColumns = columns.filter((column) => !table.conflictColumns.includes(column));
    conflictSql = updateColumns.length
      ? `ON CONFLICT (${target}) DO UPDATE SET ${updateColumns
          .map((column) => `${pg.escapeIdentifier(column)}=EXCLUDED.${pg.escapeIdentifier(column)}`)
          .join(",")}`
      : `ON CONFLICT (${target}) DO NOTHING`;
  } else {
    const predicate = columns
      .map((column, index) => `${pg.escapeIdentifier(column)} IS NOT DISTINCT FROM $${index + 1}`)
      .join(" AND ");
    const exists = await client.query(
      `SELECT 1 FROM ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(table.name)}
       WHERE ${predicate} LIMIT 1`,
      values,
    );
    if (exists.rowCount) return;
  }

  await client.query(
    `INSERT INTO ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(table.name)}
     (${columnSql}) OVERRIDING SYSTEM VALUE VALUES (${valueSql}) ${conflictSql}`,
    values,
  );
}

async function main() {
  if (!fs.existsSync(inputPath)) throw new Error(`Snapshot not found: ${inputPath}`);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const lines = readline.createInterface({
    input: fs.createReadStream(inputPath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let client: PoolClient | null = null;
  let current: TableMeta | null = null;
  let currentTableMissing = false;
  let tableRows = 0;
  let processed = 0;
  let declaredTotal: number | null = null;

  try {
    for await (const line of lines) {
      const item = JSON.parse(line);
      if (item.type === "header") {
        if (item.format !== "vaxplan-entire-database-jsonl-v1") {
          throw new Error(`Unsupported snapshot format: ${item.format}`);
        }
      } else if (item.type === "table") {
        current = item as TableMeta;
        const columns = (
          await pool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema='public' AND table_name=$1`,
            [current.name],
          )
        ).rows.map((row) => row.column_name);
        currentTableMissing = columns.length === 0;
        tableRows = 0;
        if (currentTableMissing) continue;
        const missing = current.columns.filter((column) => !columns.includes(column));
        if (missing.length) throw new Error(`${current.name} missing columns: ${missing.join(", ")}`);
        client = await pool.connect();
        await client.query("BEGIN");
      } else if (item.type === "row") {
        if (currentTableMissing && current) {
          throw new Error(`Production table is missing and contains records: ${current.name}`);
        }
        if (!client || !current) throw new Error("Row encountered outside a table.");
        await upsertRow(client, current, item.data);
        tableRows++;
        processed++;
      } else if (item.type === "table_end") {
        if (currentTableMissing && current) {
          if (item.rowCount !== 0) {
            throw new Error(
              `Production table is missing and contains ${item.rowCount} records: ${current.name}`,
            );
          }
          console.log(`${current.name}: 0 (table absent in production; no records to upsert)`);
          current = null;
          currentTableMissing = false;
          continue;
        }
        if (!client || !current) throw new Error("Table end encountered without a table.");
        if (tableRows !== item.rowCount) {
          throw new Error(`${current.name}: expected ${item.rowCount}, processed ${tableRows}`);
        }
        await client.query("COMMIT");
        client.release();
        client = null;
        console.log(`${current.name}: ${tableRows}`);
        current = null;
        currentTableMissing = false;
      } else if (item.type === "footer") {
        declaredTotal = item.totalRows;
      }
    }
    if (declaredTotal === null || processed !== declaredTotal) {
      throw new Error(`Snapshot total ${declaredTotal}; processed ${processed}.`);
    }
    console.log(`Successfully upserted every one of ${processed} records.`);
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
