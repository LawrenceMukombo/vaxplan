ALTER TYPE "public"."user_role" ADD VALUE 'facility_partner';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'district_partner';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'provincial_partner';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'national_partner';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'national_manager';--> statement-breakpoint
CREATE TABLE "cold_chain_equipment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cold_chain_equipment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"facility_id" integer NOT NULL,
	"equipment_type" varchar(60) NOT NULL,
	"brand" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"catalog_number" varchar(100),
	"capacity_liters" numeric(8, 2),
	"net_storage_capacity_liters" numeric(8, 2),
	"temperature_min" numeric(5, 1),
	"temperature_max" numeric(5, 1),
	"power_source" varchar(40),
	"energy_consumption_kwh_day" numeric(6, 2),
	"manufacture_year" integer,
	"installation_date" varchar(20),
	"purchase_cost" numeric(14, 2),
	"purchase_currency" varchar(5) DEFAULT 'USD',
	"warranty_expiry" varchar(20),
	"supplier" varchar(255),
	"donor_funded" boolean DEFAULT false,
	"funding_source" varchar(100),
	"condition" varchar(30) DEFAULT 'functional' NOT NULL,
	"last_service_date" varchar(20),
	"next_service_due" varchar(20),
	"last_temperature_check" varchar(20),
	"maintenance_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"external_id" varchar(100),
	"created_by_user_id" varchar,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_user_permissions_tenant_code" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "vgie_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vgie_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"location_geom" jsonb,
	"alert_type" varchar(100) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vgie_recommendations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vgie_recommendations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"recommendation_type" varchar(100) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"reasoning" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vgie_settlement_facility_links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vgie_settlement_facility_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"village_id" integer NOT NULL,
	"facility_id" integer NOT NULL,
	"linkage_type" varchar(50) NOT NULL,
	"travel_time_mins" integer,
	"transport_mode" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";--> statement-breakpoint
ALTER TABLE "facility_staff" ADD COLUMN "employee_id" varchar(100);--> statement-breakpoint
ALTER TABLE "facility_staff" ADD COLUMN "nrc" varchar(100);--> statement-breakpoint
ALTER TABLE "facility_staff" ADD COLUMN "history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "villages" ADD COLUMN "confidence_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "villages" ADD COLUMN "detection_source" varchar(50);--> statement-breakpoint
ALTER TABLE "villages" ADD COLUMN "is_mapped_in_hmis" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "villages" ADD COLUMN "last_verified" timestamp;--> statement-breakpoint
ALTER TABLE "cold_chain_equipment" ADD CONSTRAINT "cold_chain_equipment_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cold_chain_equipment" ADD CONSTRAINT "cold_chain_equipment_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cold_chain_equipment" ADD CONSTRAINT "cold_chain_equipment_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cold_chain_equipment" ADD CONSTRAINT "cold_chain_equipment_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vgie_alerts" ADD CONSTRAINT "vgie_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vgie_recommendations" ADD CONSTRAINT "vgie_recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vgie_settlement_facility_links" ADD CONSTRAINT "vgie_settlement_facility_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vgie_settlement_facility_links" ADD CONSTRAINT "vgie_settlement_facility_links_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vgie_settlement_facility_links" ADD CONSTRAINT "vgie_settlement_facility_links_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cce_tenant" ON "cold_chain_equipment" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_cce_facility" ON "cold_chain_equipment" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "idx_cce_condition" ON "cold_chain_equipment" USING btree ("tenant_id","condition");--> statement-breakpoint
CREATE INDEX "idx_user_permissions_tenant" ON "user_permissions" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "uq_users_tenant_email" UNIQUE("tenant_id","email");
