import { db } from "../db";
import { supervisionChecklistTemplates, tenants } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Migration 028 — Supportive Supervision Templates Seed & Upsert
 *
 * Ensures `supervision_checklist_templates` table exists and upserts the
 * 3 standard national supervision checklist templates (Short, National, Full)
 * for all active tenants using Drizzle ORM parameterized queries.
 */

function parseTemplateJson(jsonRaw: any) {
  const questions = jsonRaw.questions || [];
  const sectionTitlesSet = new Set<string>();
  questions.forEach((q: any) => {
    if (q.sectionTitle) sectionTitlesSet.add(q.sectionTitle);
  });

  const sections = Array.from(sectionTitlesSet).map((st, idx) => ({
    id: `sec-${idx + 1}`,
    title: st,
    displayOrder: idx + 1,
  }));

  const items = questions.map((q: any, idx: number) => ({
    id: `q-${idx + 1}`,
    sectionTitle: q.sectionTitle,
    type: q.answerType || "yes_no",
    label: q.questionText || q.label || `Question #${idx + 1}`,
    options: q.options || [],
    isScored: q.isScored ?? true,
    weight: q.weight ?? 1.0,
    prefillSourceKey: q.prefillSourceKey || "",
    helpText: q.helpText || "",
    required: q.required ?? false,
  }));

  return {
    name: jsonRaw.name,
    category: jsonRaw.category || "supervision",
    description: jsonRaw.description || "",
    sections,
    items,
    isActive: jsonRaw.isActive ?? true,
  };
}

export async function applySupervisionTemplatesSeed(): Promise<void> {
  console.log("[migration:028] Starting Supportive Supervision Templates Seed & Upsert...");

  // 1. Ensure table exists
  const createTableStmt = `
    CREATE TABLE IF NOT EXISTS supervision_checklist_templates (
      id                  SERIAL PRIMARY KEY,
      tenant_id           VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name                VARCHAR(200) NOT NULL,
      category            VARCHAR(50) NOT NULL DEFAULT 'supervision',
      description         TEXT,
      sections            JSONB NOT NULL DEFAULT '[]'::jsonb,
      items               JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active           BOOLEAN NOT NULL DEFAULT TRUE,
      created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_supervision_template_tenant ON supervision_checklist_templates(tenant_id);
  `;

  try {
    await db.execute(sql.raw(createTableStmt));
    console.log("[migration:028] Table supervision_checklist_templates ensured.");
  } catch (err: any) {
    console.error(`[migration:028] Error ensuring table: ${err.message}`);
  }

  // 2. Load JSON files
  const templateFilenames = [
    "Supportive_Supervision_Short_Template.json",
    "Supportive_Supervision_National_Template.json",
    "Supportive_Supervision_National_Full_Template.json",
  ];

  const parsedTemplates: any[] = [];
  const rootDir = process.cwd();

  for (const fname of templateFilenames) {
    const fullPath = join(rootDir, fname);
    if (existsSync(fullPath)) {
      try {
        const raw = JSON.parse(readFileSync(fullPath, "utf-8"));
        parsedTemplates.push(parseTemplateJson(raw));
      } catch (err: any) {
        console.error(`[migration:028] Failed to parse ${fname}: ${err.message}`);
      }
    } else {
      console.warn(`[migration:028] Template file not found: ${fullPath}`);
    }
  }

  if (parsedTemplates.length === 0) {
    console.warn("[migration:028] No template JSON files were loaded.");
    return;
  }

  // 3. Fetch all active tenants
  try {
    const allTenants = await db.select({ id: tenants.id }).from(tenants);

    if (allTenants.length === 0) {
      console.warn("[migration:028] No tenants found to seed templates.");
      return;
    }

    // 4. Upsert for each tenant using Drizzle ORM parameterized queries
    for (const tenant of allTenants) {
      for (const t of parsedTemplates) {
        const existing = await db
          .select({ id: supervisionChecklistTemplates.id })
          .from(supervisionChecklistTemplates)
          .where(
            and(
              eq(supervisionChecklistTemplates.tenantId, tenant.id),
              eq(supervisionChecklistTemplates.name, t.name)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const existingId = existing[0].id;
          await db
            .update(supervisionChecklistTemplates)
            .set({
              category: t.category,
              description: t.description,
              sections: t.sections,
              items: t.items,
              isActive: t.isActive,
              updatedAt: new Date(),
            })
            .where(eq(supervisionChecklistTemplates.id, existingId));
          console.log(`[migration:028] Updated template "${t.name}" (ID ${existingId}) for tenant "${tenant.id}".`);
        } else {
          await db
            .insert(supervisionChecklistTemplates)
            .values({
              tenantId: tenant.id,
              name: t.name,
              category: t.category,
              description: t.description,
              sections: t.sections,
              items: t.items,
              isActive: t.isActive,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          console.log(`[migration:028] Inserted template "${t.name}" for tenant "${tenant.id}".`);
        }
      }
    }

    console.log("[migration:028] Supportive Supervision Templates seed complete.");
  } catch (err: any) {
    console.error(`[migration:028] Error during seed: ${err.message}`);
  }
}
