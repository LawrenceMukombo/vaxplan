import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  console.log("Starting safe database migration for gis_polygons...");

  try {
    // 1. Create the enum if it doesn't exist
    console.log("Creating ENUM gis_polygon_type...");
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."gis_polygon_type" AS ENUM('catchment', 'outreach_area', 'administrative_boundary', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create the table
    console.log("Creating TABLE gis_polygons...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "gis_polygons" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "tenant_id" varchar NOT NULL,
        "owner_type" varchar(50) NOT NULL,
        "owner_id" integer NOT NULL,
        "polygon_type" "public"."gis_polygon_type" DEFAULT 'catchment' NOT NULL,
        "name" varchar(255),
        "description" text,
        "geometry" jsonb NOT NULL,
        "area_sq_km" numeric(10, 2),
        "perimeter_km" numeric(10, 2),
        "source" varchar(100),
        "method" varchar(100),
        "status" varchar(50) DEFAULT 'active',
        "version" integer DEFAULT 1,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);

    // 3. Add foreign key constraint
    console.log("Adding foreign key constraint...");
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "gis_polygons" ADD CONSTRAINT "gis_polygons_tenant_id_tenants_id_fk" 
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 4. Create indexes
    console.log("Creating indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_gis_polygons_tenant" ON "gis_polygons" USING btree ("tenant_id");
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_gis_polygons_owner" ON "gis_polygons" USING btree ("owner_type","owner_id");
    `);

    console.log("✅ Safe database migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
