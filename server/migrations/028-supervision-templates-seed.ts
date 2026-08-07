import { db } from "../db";
import { sql } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Migration 028 — Supportive Supervision Templates Seed & Upsert
 *
 * Ensures `supervision_checklist_templates` table exists and upserts the
 * 3 standard national supervision checklist templates (Short, National, Full)
 * for all active tenants using clean parameterized SQL execution.
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

  // 3. Fetch all active tenant IDs
  try {
    const tenantsRes = await db.execute(sql`SELECT id FROM tenants`);
    const tenantIds = tenantsRes.rows.map((r: any) => r.id as string);

    if (tenantIds.length === 0) {
      console.warn("[migration:028] No tenants found to seed templates.");
      return;
    }

    // 4. Upsert for each tenant using clean parameterized SQL
    for (const tenantId of tenantIds) {
      for (const t of parsedTemplates) {
        try {
          const checkRes = await db.execute(sql`
            SELECT id FROM supervision_checklist_templates
            WHERE tenant_id = ${tenantId}
              AND name = ${t.name}
            LIMIT 1
          `);

          const sectionsJsonStr = JSON.stringify(t.sections);
          const itemsJsonStr = JSON.stringify(t.items);

          if (checkRes.rows.length > 0) {
            const existingId = (checkRes.rows[0] as any).id;
            await db.execute(sql`
              UPDATE supervision_checklist_templates
              SET category = ${t.category},
                  description = ${t.description},
                  sections = ${sectionsJsonStr}::jsonb,
                  items = ${itemsJsonStr}::jsonb,
                  is_active = ${t.isActive},
                  updated_at = NOW()
              WHERE id = ${existingId}
            `);
            console.log(`[migration:028] Updated template "${t.name}" (ID ${existingId}) for tenant "${tenantId}".`);
          } else {
            await db.execute(sql`
              INSERT INTO supervision_checklist_templates (
                tenant_id, name, category, description, sections, items, is_active
              ) VALUES (
                ${tenantId},
                ${t.name},
                ${t.category},
                ${t.description},
                ${sectionsJsonStr}::jsonb,
                ${itemsJsonStr}::jsonb,
                ${t.isActive}
              )
            `);
            console.log(`[migration:028] Inserted template "${t.name}" for tenant "${tenantId}".`);
          }
        } catch (itemErr: any) {
          console.error(
            `[migration:028] Error seeding template "${t.name}" for tenant "${tenantId}":`,
            itemErr?.detail || itemErr?.message || itemErr
          );
        }
      }
    }

    console.log("[migration:028] Supportive Supervision Templates seed complete.");
  } catch (err: any) {
    console.error(`[migration:028] Fatal error during seed: ${err?.detail || err?.message || err}`);
  }
}
