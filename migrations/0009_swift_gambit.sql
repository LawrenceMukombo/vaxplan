CREATE TYPE "public"."commodity_type" AS ENUM('diluent', 'syringe', 'safety_box', 'ppe', 'cold_chain', 'other');--> statement-breakpoint
CREATE TYPE "public"."dose_classification" AS ENUM('routine', 'campaign', 'outbreak', 'school_based', 'other');--> statement-breakpoint
ALTER TYPE "public"."approval_status" ADD VALUE 'under_review';--> statement-breakpoint
ALTER TYPE "public"."approval_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TYPE "public"."approval_status" ADD VALUE 'archived';--> statement-breakpoint
ALTER TYPE "public"."approval_status" ADD VALUE 'superseded';--> statement-breakpoint
CREATE TABLE "catalogue_commodities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalogue_commodities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"commodity_code" varchar(100) NOT NULL,
	"type" "commodity_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"unit_of_measure" varchar(50) DEFAULT 'pieces',
	"pack_size" integer DEFAULT 100 NOT NULL,
	"stock_managed" boolean DEFAULT true NOT NULL,
	"forecastable" boolean DEFAULT true NOT NULL,
	"requisitionable" boolean DEFAULT true NOT NULL,
	"session_supply" boolean DEFAULT true NOT NULL,
	"linked_vaccine_id" integer,
	"consumption_rule" jsonb DEFAULT '{}'::jsonb,
	"buffer_percentage" numeric(5, 2) DEFAULT '10.00',
	"minimum_stock_threshold" integer DEFAULT 0,
	"maximum_stock_threshold" integer DEFAULT 0,
	"reorder_level" integer DEFAULT 0,
	"modules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalogue_schedule_doses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalogue_schedule_doses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"vaccine_id" integer NOT NULL,
	"dose_code" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"dose_number" integer DEFAULT 1 NOT NULL,
	"target_age" varchar(100),
	"minimum_age" varchar(100),
	"maximum_age" varchar(100),
	"minimum_interval" varchar(100),
	"target_population_group" varchar(100) DEFAULT 'infants',
	"route" varchar(100),
	"site" varchar(100),
	"classification" "dose_classification" DEFAULT 'routine' NOT NULL,
	"stock_deducting" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_start_date" timestamp DEFAULT now(),
	"approval_status" "approval_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalogue_vaccines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalogue_vaccines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"antigen_name" varchar(255),
	"category" varchar(100) DEFAULT 'Vaccine',
	"presentation" varchar(100),
	"doses_per_vial" integer DEFAULT 1 NOT NULL,
	"unit_of_measure" varchar(50) DEFAULT 'vials',
	"storage_temperature" varchar(50) DEFAULT '+2 to +8 °C',
	"wastage_threshold" numeric(5, 2) DEFAULT '10.00',
	"stock_managed" boolean DEFAULT true NOT NULL,
	"forecastable" boolean DEFAULT true NOT NULL,
	"requisitionable" boolean DEFAULT true NOT NULL,
	"requires_diluent" boolean DEFAULT false NOT NULL,
	"requires_injection_device" boolean DEFAULT true NOT NULL,
	"requires_safety_box" boolean DEFAULT true NOT NULL,
	"routine_use" boolean DEFAULT true NOT NULL,
	"campaign_use" boolean DEFAULT false NOT NULL,
	"outbreak_use" boolean DEFAULT false NOT NULL,
	"modules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"approval_status" "approval_status" DEFAULT 'draft' NOT NULL,
	"effective_start_date" timestamp DEFAULT now(),
	"effective_end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "catalogue_wastage_thresholds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "catalogue_wastage_thresholds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"vaccine_id" integer NOT NULL,
	"wastage_rate" numeric(5, 2) NOT NULL,
	"wastage_factor" numeric(5, 2) NOT NULL,
	"min_acceptable" numeric(5, 2),
	"max_acceptable" numeric(5, 2),
	"strategy" varchar(100) DEFAULT 'routine',
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"effective_start_date" timestamp DEFAULT now(),
	"effective_end_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "download_assets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "download_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"recommended_audience" varchar(255),
	"file_url" varchar(512),
	"file_name" varchar(255),
	"file_type" varchar(100),
	"file_size" integer,
	"version" varchar(50) DEFAULT '1.0.0',
	"status" varchar(50) DEFAULT 'Published' NOT NULL,
	"visibility" varchar(50) DEFAULT 'Public' NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" varchar,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "implementation_lessons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "implementation_lessons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"context" text,
	"what_was_tested" text,
	"what_worked" text,
	"what_did_not_work" text,
	"recommendation" text,
	"pilot_id" integer,
	"document_id" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'Published' NOT NULL,
	"visibility" varchar(50) DEFAULT 'Public' NOT NULL,
	"author" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pilot_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"summary" text,
	"country" varchar(100) NOT NULL,
	"province" varchar(100),
	"district" varchar(100),
	"facility" varchar(255),
	"communities" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"start_date" varchar(20),
	"end_date" varchar(20),
	"status" varchar(50) DEFAULT 'Planned' NOT NULL,
	"pilot_type" varchar(100),
	"partners" varchar(255),
	"ministry_focal_point" varchar(255),
	"technical_lead" varchar(255),
	"objectives" text,
	"research_questions" text,
	"methodology" text,
	"indicators" jsonb DEFAULT '[]'::jsonb,
	"baseline_findings" text,
	"achievements" text,
	"challenges" text,
	"lessons_learned" text,
	"recommendations" text,
	"ethics_status" varchar(100),
	"visibility" varchar(50) DEFAULT 'Public' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pilot_updates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pilot_updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pilot_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"update_date" varchar(20) NOT NULL,
	"update_type" varchar(100),
	"description" text,
	"achievements" text,
	"challenges" text,
	"next_steps" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "research_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"abstract" text,
	"document_type" varchar(100) NOT NULL,
	"authors" varchar(255),
	"organizations" varchar(255),
	"publication_date" varchar(20),
	"year" integer,
	"version" varchar(50) DEFAULT '1.0.0',
	"country" varchar(100),
	"region" varchar(100),
	"language" varchar(50) DEFAULT 'en',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'Draft' NOT NULL,
	"visibility" varchar(50) DEFAULT 'Public' NOT NULL,
	"file_url" varchar(512),
	"file_name" varchar(255),
	"file_type" varchar(100),
	"file_size" integer,
	"thumbnail_url" varchar(512),
	"citation_text" text,
	"doi" varchar(100),
	"license" varchar(100) DEFAULT 'CC BY 4.0',
	"is_featured" boolean DEFAULT false NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" varchar,
	"updated_by_user_id" varchar,
	"published_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "research_download_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "research_download_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"document_id" integer,
	"asset_id" integer,
	"user_id" varchar,
	"ip_hash" varchar(64),
	"user_agent" text,
	"downloaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_interest_submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "research_interest_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" varchar NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"organization" varchar(255),
	"role" varchar(255),
	"email" varchar(255) NOT NULL,
	"country" varchar(100),
	"area_of_interest" varchar(255),
	"message" text,
	"consent" boolean DEFAULT false NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_transactions" ALTER COLUMN "vaccine_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "microplans" ADD COLUMN "created_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "microplans" ADD COLUMN "updated_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "microplans" ADD COLUMN "approved_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "created_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "updated_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "approved_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "population_data" ADD COLUMN "created_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "population_data" ADD COLUMN "updated_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "population_data" ADD COLUMN "approved_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD COLUMN "product_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD COLUMN "product_code" varchar(100);--> statement-breakpoint
ALTER TABLE "catalogue_commodities" ADD CONSTRAINT "catalogue_commodities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_commodities" ADD CONSTRAINT "catalogue_commodities_linked_vaccine_id_catalogue_vaccines_id_fk" FOREIGN KEY ("linked_vaccine_id") REFERENCES "public"."catalogue_vaccines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_schedule_doses" ADD CONSTRAINT "catalogue_schedule_doses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_schedule_doses" ADD CONSTRAINT "catalogue_schedule_doses_vaccine_id_catalogue_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "public"."catalogue_vaccines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_vaccines" ADD CONSTRAINT "catalogue_vaccines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_wastage_thresholds" ADD CONSTRAINT "catalogue_wastage_thresholds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_wastage_thresholds" ADD CONSTRAINT "catalogue_wastage_thresholds_vaccine_id_catalogue_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "public"."catalogue_vaccines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_assets" ADD CONSTRAINT "download_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_assets" ADD CONSTRAINT "download_assets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_lessons" ADD CONSTRAINT "implementation_lessons_pilot_id_pilot_activities_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."pilot_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_lessons" ADD CONSTRAINT "implementation_lessons_document_id_research_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."research_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_activities" ADD CONSTRAINT "pilot_activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_activities" ADD CONSTRAINT "pilot_activities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_updates" ADD CONSTRAINT "pilot_updates_pilot_id_pilot_activities_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."pilot_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_updates" ADD CONSTRAINT "pilot_updates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_download_events" ADD CONSTRAINT "research_download_events_document_id_research_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."research_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_download_events" ADD CONSTRAINT "research_download_events_asset_id_download_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."download_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_download_events" ADD CONSTRAINT "research_download_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_catalogue_commodities_tenant" ON "catalogue_commodities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_commodities_code" ON "catalogue_commodities" USING btree ("commodity_code");--> statement-breakpoint
CREATE INDEX "idx_catalogue_doses_tenant" ON "catalogue_schedule_doses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_doses_vaccine" ON "catalogue_schedule_doses" USING btree ("vaccine_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_vaccines_tenant" ON "catalogue_vaccines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_vaccines_product" ON "catalogue_vaccines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_wastage_tenant" ON "catalogue_wastage_thresholds" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_catalogue_wastage_vaccine" ON "catalogue_wastage_thresholds" USING btree ("vaccine_id");--> statement-breakpoint
CREATE INDEX "idx_download_asset_tenant" ON "download_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_impl_lesson_tenant" ON "implementation_lessons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_impl_lesson_category" ON "implementation_lessons" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_pilot_act_tenant" ON "pilot_activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_pilot_act_status" ON "pilot_activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pilot_upd_pilot" ON "pilot_updates" USING btree ("pilot_id");--> statement-breakpoint
CREATE INDEX "idx_research_doc_tenant" ON "research_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_research_doc_status" ON "research_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_res_interest_tenant" ON "research_interest_submissions" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "microplans" ADD CONSTRAINT "microplans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microplans" ADD CONSTRAINT "microplans_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microplans" ADD CONSTRAINT "microplans_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_data" ADD CONSTRAINT "population_data_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_data" ADD CONSTRAINT "population_data_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "population_data" ADD CONSTRAINT "population_data_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_product_id_catalogue_vaccines_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalogue_vaccines"("id") ON DELETE restrict ON UPDATE no action;