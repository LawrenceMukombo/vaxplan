/**
 * ISS-01: One-time migration script — backfill productId on existing stock_transactions rows.
 *
 * For each stock transaction that has a non-null vaccineName but a null productId,
 * this script attempts to find a matching catalogue_vaccines row by name (case-insensitive,
 * normalizing whitespace and common separators) within the same tenant and writes the
 * catalogue vaccine's id back into stock_transactions.product_id.
 *
 * Run with:
 *   npx tsx --env-file=.env scripts/migrate-stock-product-ids.ts
 *
 * Safe to run multiple times — only rows with productId IS NULL are updated.
 * Rows that cannot be matched are logged to stdout for manual review.
 */

import { db } from "../server/db";
import { stockTransactions, catalogueVaccines } from "../shared/schema";
import { eq, isNull, and } from "drizzle-orm";

async function main() {
  console.log("ISS-01 migration: backfilling productId on stock_transactions …");

  // Fetch all transactions missing a productId
  const unlinked = await db
    .select({
      id: stockTransactions.id,
      tenantId: stockTransactions.tenantId,
      vaccineName: stockTransactions.vaccineName,
    })
    .from(stockTransactions)
    .where(isNull(stockTransactions.productId));

  console.log(`  Found ${unlinked.length} transaction(s) with null productId.`);

  // Load all catalogue vaccines, grouped by tenant for fast lookup
  const allCatalogueVaccines = await db
    .select({
      id: catalogueVaccines.id,
      tenantId: catalogueVaccines.tenantId,
      name: catalogueVaccines.name,
      productId: catalogueVaccines.productId,
    })
    .from(catalogueVaccines);

  // Build a lookup map: tenantId → { normalizedName → catalogue id }
  const catalogueByTenant = new Map<string, Map<string, number>>();
  for (const v of allCatalogueVaccines) {
    if (!catalogueByTenant.has(v.tenantId)) {
      catalogueByTenant.set(v.tenantId, new Map());
    }
    const norm = normalize(v.name);
    catalogueByTenant.get(v.tenantId)!.set(norm, v.id);
    // Also index by productId slug (e.g. "vaccine_product_penta" → "penta")
    const slug = v.productId.replace(/^vaccine_product_/i, "");
    catalogueByTenant.get(v.tenantId)!.set(normalize(slug), v.id);
  }

  let updated = 0;
  const unmatched: typeof unlinked = [];

  for (const txn of unlinked) {
    if (!txn.vaccineName) {
      unmatched.push(txn);
      continue;
    }
    const tenantMap = catalogueByTenant.get(txn.tenantId);
    if (!tenantMap) {
      unmatched.push(txn);
      continue;
    }

    const normName = normalize(txn.vaccineName);
    let matchId = tenantMap.get(normName);

    // Fuzzy: try prefix match (e.g. "Penta-1" → "penta")
    if (!matchId) {
      for (const [key, id] of tenantMap.entries()) {
        if (normName.startsWith(key) || key.startsWith(normName)) {
          matchId = id;
          break;
        }
      }
    }

    if (matchId) {
      await db
        .update(stockTransactions)
        .set({ productId: matchId })
        .where(and(eq(stockTransactions.id, txn.id), eq(stockTransactions.tenantId, txn.tenantId)));
      updated++;
    } else {
      unmatched.push(txn);
    }
  }

  console.log(`  Updated: ${updated} transaction(s).`);
  if (unmatched.length > 0) {
    console.warn(`  Could not match ${unmatched.length} transaction(s) — manual review needed:`);
    for (const t of unmatched) {
      console.warn(`    id=${t.id} tenant=${t.tenantId} vaccineName="${t.vaccineName}"`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_\s]+/g, "")   // strip separators
    .replace(/\d+$/, "");       // strip trailing dose number (penta1 → penta)
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
