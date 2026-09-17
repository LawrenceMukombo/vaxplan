import { readFileSync, readdirSync } from "node:fs";

const files = readdirSync(new URL("../migrations/", import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8").trim();
  if (!sql) throw new Error(`Migration is empty: ${file}`);
  if (/\b(DROP\s+DATABASE|DROP\s+SCHEMA)\b/i.test(sql)) {
    throw new Error(`Destructive database/schema drop is forbidden in migrations: ${file}`);
  }
}

console.log(`Validated ${files.length} ordered SQL migration files.`);
