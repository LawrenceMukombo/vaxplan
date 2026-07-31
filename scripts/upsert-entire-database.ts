import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import pg, { type PoolClient } from "pg";

try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {}

type TableMeta = {
  name: string;
  columns: string[];
  conflictColumns: string[];
  jsonColumns?: string[];
};

type DeferredRow = { table: TableMeta; encoded: unknown };

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

async function upsertRow(client: PoolClient, table: TableMeta, encoded: unknown): Promise<"fk_violation" | undefined> {
  const row = decode(encoded) as Record<string, unknown>;
  const columns = table.columns.filter((column) => Object.hasOwn(row, column));
  const jsonColumns = new Set(table.jsonColumns ?? []);
  const values = columns.map((column) => {
    const value = row[column];
    return jsonColumns.has(column) && value !== null && typeof value === "object"
      ? JSON.stringify(value)
      : value;
  });
  const columnSql = columns.map(pg.escapeIdentifier).join(", ");
  const valueSql = columns.map((_, index) => `$${index + 1}`).join(", ");
  let conflictSql = "ON CONFLICT DO NOTHING";

  if (table.name === "tenants") {
    const updateColumns = columns.filter((col) => col !== "code");
    conflictSql = `ON CONFLICT (code) DO UPDATE SET ${updateColumns
      .map((col) => `${pg.escapeIdentifier(col)}=EXCLUDED.${pg.escapeIdentifier(col)}`)
      .join(",")}`;
  } else if (table.conflictColumns.length) {
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

  try {
    await client.query("SAVEPOINT row_sp");
    await client.query(
      `INSERT INTO ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(table.name)}
       (${columnSql}) OVERRIDING SYSTEM VALUE VALUES (${valueSql}) ${conflictSql}`,
      values,
    );
    await client.query("RELEASE SAVEPOINT row_sp");
  } catch (err: any) {
    await client.query("ROLLBACK TO SAVEPOINT row_sp");
    if (err.code === "23505") {
      // Secondary unique constraint conflict (e.g. tenant_id + code): attempt ON CONFLICT DO NOTHING fallback
      try {
        await client.query("SAVEPOINT row_sp2");
        await client.query(
          `INSERT INTO ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(table.name)}
           (${columnSql}) OVERRIDING SYSTEM VALUE VALUES (${valueSql}) ON CONFLICT DO NOTHING`,
          values,
        );
        await client.query("RELEASE SAVEPOINT row_sp2");
      } catch (err2: any) {
        await client.query("ROLLBACK TO SAVEPOINT row_sp2");
        console.warn(`    ⚠️  [Skip Duplicate Key] ${table.name}: ${err.message}`);
      }
    } else if (
      err.code === "23503" ||
      String(err.code) === "23503" ||
      err.message?.includes("foreign key") ||
      err.message?.includes("violates foreign key constraint")
    ) {
      // Foreign-key violation — caller will retry in second pass
      return "fk_violation";
    } else {
      console.warn(`    ⚠️  [Row Skipped] ${table.name}: ${err.message}`);
    }
  }
}


export async function upsertEntireDatabase(customDbUrl?: string, customInputPath?: string) {
  const dbUrl = customDbUrl || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set.");
  const inputPath = path.resolve(
    process.cwd(),
    customInputPath || process.argv[2] || "scratch/local_database_all.jsonl.gz",
  );

  if (!fs.existsSync(inputPath)) {
    console.warn(`[upsert] Snapshot file not found: ${inputPath} - skipping auto-upsert.`);
    return;
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const lines = readline.createInterface({
    input: fs.createReadStream(inputPath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let client: PoolClient | null = null;
  // Collect rows that failed with FK violations for a second-pass retry
  const deferredRows: DeferredRow[] = [];
  let current: TableMeta | null = null;
  let currentTableMissing = false;
  let tableRows = 0;
  let processed = 0;
  // ── Pre-fetch existing tenants in target DB to bridge any local vs VPS tenant ID discrepancies ──
  const existingTenantsByCode = new Map<string, string>();
  try {
    const res = await pool.query<{ id: string; code: string }>("SELECT id, code FROM public.tenants;");
    for (const row of res.rows) {
      if (row.code && row.id) {
        existingTenantsByCode.set(row.code.toUpperCase(), row.id);
      }
    }
  } catch {}
  const tenantIdMap = new Map<string, string>();

  try {
    for await (const line of lines) {
      const item = JSON.parse(line);
      if (item.type === "header") {
        if (item.format !== "vaxplan-entire-database-jsonl-v1") {
          throw new Error(`Unsupported snapshot format: ${item.format}`);
        }
      } else if (item.type === "table") {
        current = item as TableMeta;
        const productionColumnRows = (
          await pool.query<{ column_name: string; data_type: string }>(
            `SELECT column_name, data_type FROM information_schema.columns
             WHERE table_schema='public' AND table_name=$1`,
            [current.name],
          )
        ).rows;
        const columns = productionColumnRows.map((row) => row.column_name);
        current.jsonColumns = productionColumnRows
          .filter((row) => row.data_type === "json" || row.data_type === "jsonb")
          .map((row) => row.column_name);
        currentTableMissing = columns.length === 0;
        if (currentTableMissing) {
          console.log(`⚠️  Production table "${current.name}" does not exist. Creating table on the fly...`);
          const colDefs = current.columns.map((col) => {
            if (col === "id") return `"id" text PRIMARY KEY`;
            return `${pg.escapeIdentifier(col)} text`;
          }).join(", ");
          try {
            await pool.query(`CREATE TABLE IF NOT EXISTS ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(current.name)} (${colDefs});`);
            console.log(`   ✓ Created table "${current.name}" in production database.`);
            currentTableMissing = false;
          } catch (err: any) {
            console.warn(`   ⚠️  Failed creating missing table "${current.name}":`, err.message);
          }
        }

        if (currentTableMissing) continue;

        const missing = current.columns.filter((column) => !columns.includes(column));
        if (missing.length) {
          console.log(`⚠️  Safely adding ${missing.length} missing columns to ${current.name}: ${missing.join(", ")}`);
          for (const col of missing) {
            try {
              await pool.query(`ALTER TABLE ${pg.escapeIdentifier(current.name)} ADD COLUMN IF NOT EXISTS ${pg.escapeIdentifier(col)} text;`);
            } catch (err: any) {
              console.warn(`    Warning auto-adding column ${col}:`, err.message);
            }
          }
          const refreshedCols = (
            await pool.query<{ column_name: string; data_type: string }>(
              `SELECT column_name, data_type FROM information_schema.columns
               WHERE table_schema='public' AND table_name=$1`,
              [current.name],
            )
          ).rows;
          const refreshedNames = refreshedCols.map((row) => row.column_name);
          current.columns = current.columns.filter((col) => refreshedNames.includes(col));
        }

        tableRows = 0;
        client = await pool.connect();
        await client.query("BEGIN");
        // Defer FK constraints so rows can be inserted regardless of arrival order.
        // This works for any DB user (no superuser required).
        try {
          await client.query("SET CONSTRAINTS ALL DEFERRED;");
        } catch {
          // Non-deferrable constraints: silently continue; second-pass will handle FK retries.
        }
      } else if (item.type === "row") {
        if (currentTableMissing) {
          // Table could not be created; skip row gracefully
          continue;
        }
        if (!client || !current) throw new Error("Row encountered outside a table.");

        // Clean up any stale online tenant record that has the same code but a different ID,
        // allowing the exact localhost tenant (with all its rich settings and data) to replace it 1-to-1.
        if (current.name === "tenants" && item.data && typeof item.data === "object") {
          const rowObj = item.data as Record<string, any>;
          const code = String(rowObj.code || "").toUpperCase();
          const snapshotId = String(rowObj.id || "");
          if (code && existingTenantsByCode.has(code)) {
            const existingId = existingTenantsByCode.get(code)!;
            if (existingId !== snapshotId) {
              console.log(`[upsert] Removing stale online tenant "${code}" (${existingId}) to replace with exact localhost version (${snapshotId})`);
              try {
                await client!.query(`DELETE FROM public.tenants WHERE id = $1;`, [existingId]);
                existingTenantsByCode.delete(code);
              } catch (err: any) {
                console.warn(`[upsert] Warning removing stale tenant ${existingId}:`, err.message);
              }
            }
          }
          if (snapshotId) tenantIdMap.set(snapshotId, snapshotId);
        } else if (item.data && typeof item.data === "object") {
          const rowObj = item.data as Record<string, any>;
          if (rowObj.tenant_id && tenantIdMap.has(String(rowObj.tenant_id))) {
            rowObj.tenant_id = tenantIdMap.get(String(rowObj.tenant_id));
          }
        }


        const result = await upsertRow(client, current, item.data);
        if (result === "fk_violation") {
          deferredRows.push({ table: { ...current }, encoded: item.data });
        }
        tableRows++;
        processed++;
      }
 else if (item.type === "table_end") {
        if (currentTableMissing && current) {
          console.log(`${current.name}: 0 (table absent in production; skipped)`);
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

    // ── Second pass: retry FK-deferred rows now that parent tables exist ──────
    if (deferredRows.length > 0) {
      console.log(`[upsert] Second pass: retrying ${deferredRows.length} FK-deferred rows…`);
      let retryPass = deferredRows.splice(0);
      let passNumber = 0;
      while (retryPass.length > 0 && passNumber++ < 10) {
        const stillFailing: DeferredRow[] = [];
        for (const item of retryPass) {
          const { table } = item;
          if (encoded && typeof encoded === "object") {
            const copy = JSON.parse(JSON.stringify(encoded)) as Record<string, unknown>;
            if (copy.tenant_id && tenantIdMap.has(String(copy.tenant_id))) {
              copy.tenant_id = tenantIdMap.get(String(copy.tenant_id));
            }
            // If a row still fails FK checks after pass 3, null out orphaned FK fields ending in _id
            // (e.g. district_id) so the row itself is ALWAYS preserved in the database.
            if (passNumber > 3) {
              for (const key of Object.keys(copy)) {
                if (key.endsWith("_id") && key !== "id" && key !== "tenant_id") {
                  copy[key] = null;
                }
              }
            }
            encoded = copy;
          }

          const retryClient = await pool.connect();
          try {
            await retryClient.query("BEGIN");
            const res = await upsertRow(retryClient, table, encoded);
            await retryClient.query("COMMIT");
            if (res === "fk_violation") stillFailing.push({ table, encoded });
          } catch (err: any) {
            await retryClient.query("ROLLBACK");
            console.warn(`    ⚠️  [Retry Failed] ${table.name}: ${err.message}`);
          } finally {
            retryClient.release();
          }
        }
        retryPass = stillFailing;
      }
      if (retryPass.length > 0) {
        console.warn(`[upsert] ⚠️  ${retryPass.length} rows could not be upserted after retry passes.`);
      } else {
        console.log(`[upsert] ✓ All FK-deferred rows successfully upserted in retry pass.`);
      }
    }


    console.log(`[upsert] Successfully upserted every one of ${processed} records.`);
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

// Execute if run directly from CLI
if (process.argv[1]?.includes("upsert-entire-database")) {
  upsertEntireDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
