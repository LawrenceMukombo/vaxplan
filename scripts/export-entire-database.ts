import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { createGzip } from "node:zlib";
import pg from "pg";

try {
  // @ts-ignore
  process.loadEnvFile?.();
} catch {}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
const outputPath = path.resolve(
  process.cwd(),
  process.argv[2] || "scratch/local_database_all.jsonl.gz",
);

type TableMeta = {
  name: string;
  columns: string[];
  conflictColumns: string[];
  dependencies: string[];
};

function encode(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { $type: "bytea", value: value.toString("base64") };
  if (value instanceof Date) return { $type: "date", value: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function orderTables(tables: TableMeta[]): TableMeta[] {
  const remaining = new Map(tables.map((table) => [table.name, table]));
  const ordered: TableMeta[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((table) =>
      table.dependencies.every((dependency) => !remaining.has(dependency)),
    );
    if (!ready.length) {
      ordered.push(...[...remaining.values()].sort((a, b) => a.name.localeCompare(b.name)));
      break;
    }
    for (const table of ready.sort((a, b) => a.name.localeCompare(b.name))) {
      ordered.push(table);
      remaining.delete(table.name);
    }
  }
  return ordered;
}

async function writeLine(stream: NodeJS.WritableStream, value: unknown) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, "drain");
}

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const file = fs.createWriteStream(outputPath);
  const gzip = createGzip({ level: 9 });
  gzip.pipe(file);

  try {
    const tableNames = (
      await pool.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `)
    ).rows.map((row) => row.table_name);

    const metadata: TableMeta[] = [];
    for (const name of tableNames) {
      const columns = (
        await pool.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
           ORDER BY ordinal_position`,
          [name],
        )
      ).rows.map((row) => row.column_name);
      const unique = await pool.query<{ columns: string[] }>(
        `SELECT array_agg(a.attname ORDER BY x.ordinality)::text[] AS columns
         FROM pg_index i
         JOIN pg_class t ON t.oid=i.indrelid
         JOIN pg_namespace n ON n.oid=t.relnamespace
         JOIN unnest(i.indkey) WITH ORDINALITY x(attnum,ordinality) ON true
         JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=x.attnum
         WHERE n.nspname='public' AND t.relname=$1 AND i.indisunique AND i.indpred IS NULL
         GROUP BY i.indexrelid
         ORDER BY bool_or(i.indisprimary) DESC, count(*) ASC LIMIT 1`,
        [name],
      );
      const dependencies = (
        await pool.query<{ dependency: string }>(
          `SELECT DISTINCT parent.relname AS dependency
           FROM pg_constraint c
           JOIN pg_class child ON child.oid=c.conrelid
           JOIN pg_namespace cn ON cn.oid=child.relnamespace
           JOIN pg_class parent ON parent.oid=c.confrelid
           JOIN pg_namespace pn ON pn.oid=parent.relnamespace
           WHERE c.contype='f' AND cn.nspname='public' AND pn.nspname='public'
             AND child.relname=$1 AND parent.relname<>child.relname`,
          [name],
        )
      ).rows.map((row) => row.dependency);
      metadata.push({ name, columns, conflictColumns: unique.rows[0]?.columns ?? [], dependencies });
    }

    await writeLine(gzip, {
      type: "header",
      format: "vaxplan-entire-database-jsonl-v1",
      exportedAt: new Date().toISOString(),
      schema: "public",
      tableCount: metadata.length,
    });

    let totalRows = 0;
    for (const table of orderTables(metadata)) {
      await writeLine(gzip, { type: "table", ...table });
      const columnsSql = table.columns.map(pg.escapeIdentifier).join(", ");
      const result = await pool.query(
        `SELECT ${columnsSql} FROM ${pg.escapeIdentifier("public")}.${pg.escapeIdentifier(table.name)}`,
      );
      for (const row of result.rows) await writeLine(gzip, { type: "row", data: encode(row) });
      await writeLine(gzip, { type: "table_end", name: table.name, rowCount: result.rows.length });
      totalRows += result.rows.length;
      console.log(`${table.name}: ${result.rows.length}`);
    }
    await writeLine(gzip, { type: "footer", tableCount: metadata.length, totalRows });
    gzip.end();
    await once(file, "close");
    console.log(`Exported ${totalRows} rows from ${metadata.length} tables to ${outputPath}`);
  } catch (error) {
    gzip.destroy();
    file.destroy();
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
