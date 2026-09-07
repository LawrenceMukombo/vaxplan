import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Supabase requires SSL. Automatically append sslmode if missing.
let connString = process.env.DATABASE_URL;
if (
  (connString.includes("supabase.co") || connString.includes("upstash.io")) &&
  !connString.includes("sslmode=")
) {
  connString += connString.includes("?") ? "&sslmode=require" : "?sslmode=require";
}

export const pool = new Pool({ connectionString: connString });

// Prevent unhandled pool errors from crashing the process.
// These happen when an idle client in the pool loses its connection
// (e.g. server restart, network blip). The pool will silently discard
// the dead client and create a new one on the next query.
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error (connection may have been lost):", err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Lightweight database connectivity check.
 * Returns `true` if the database is reachable, `false` otherwise.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
