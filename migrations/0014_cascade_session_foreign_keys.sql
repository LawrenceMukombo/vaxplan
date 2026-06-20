ALTER TABLE "budget_items" DROP CONSTRAINT "budget_items_session_id_session_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "session_villages" DROP CONSTRAINT "session_villages_session_id_session_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_session_id_session_plans_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_villages" ADD CONSTRAINT "session_villages_session_id_session_plans_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session_plans"("id") ON DELETE cascade ON UPDATE no action;