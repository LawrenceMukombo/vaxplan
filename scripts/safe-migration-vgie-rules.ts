import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

try {
  const envPath = path.join(process.cwd(), ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...value] = line.split("=");
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join("=").trim().replace(/(^['"]|['"]$)/g, '');
    }
  }
} catch (e) {
  console.log("No .env file found or error reading it.");
}

async function main() {
  const { db } = await import("../server/db");
  console.log("Starting safe database migration for vgie_recommendation_rules and vgie_alert_rules...");

  try {
    // 1. Create the recommendation rules table
    console.log("Creating TABLE vgie_recommendation_rules...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "vgie_recommendation_rules" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "tenant_id" varchar NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100) NOT NULL,
        "condition_sql" text NOT NULL,
        "recommendation_text" text NOT NULL,
        "priority" varchar(50) DEFAULT 'medium' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by_user_id" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // 2. Create the alert rules table
    console.log("Creating TABLE vgie_alert_rules...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "vgie_alert_rules" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "tenant_id" varchar NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "severity" varchar(50) DEFAULT 'warning' NOT NULL,
        "trigger_condition" text NOT NULL,
        "alert_template" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by_user_id" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // 3. Add foreign key constraints
    console.log("Adding foreign key constraints...");
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "vgie_recommendation_rules" ADD CONSTRAINT "vgie_rec_rules_tenant_id_fk" 
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "vgie_alert_rules" ADD CONSTRAINT "vgie_alert_rules_tenant_id_fk" 
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 4. Create indexes
    console.log("Creating indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_vgie_rec_rules_tenant" ON "vgie_recommendation_rules" USING btree ("tenant_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_vgie_alert_rules_tenant" ON "vgie_alert_rules" USING btree ("tenant_id");
    `);

    console.log("✅ Safe database migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
