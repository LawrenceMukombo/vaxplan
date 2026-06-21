CREATE TYPE "public"."gis_polygon_type" AS ENUM('catchment', 'outreach_area', 'administrative_boundary', 'custom');--> statement-breakpoint
CREATE TABLE "gis_polygons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gis_polygons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"owner_type" varchar(50) NOT NULL,
	"owner_id" integer NOT NULL,
	"polygon_type" "gis_polygon_type" DEFAULT 'catchment' NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "gis_polygons" ADD CONSTRAINT "gis_polygons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gis_polygons_tenant" ON "gis_polygons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_gis_polygons_owner" ON "gis_polygons" USING btree ("owner_type","owner_id");