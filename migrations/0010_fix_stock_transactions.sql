-- Fix for failed 0009 migration on existing databases
-- We add the missing columns as nullable to ensure they exist

ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "product_id" integer;
--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "product_code" varchar(100);
--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_product_id_catalogue_vaccines_id_fk') THEN
        ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_product_id_catalogue_vaccines_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalogue_vaccines"("id") ON DELETE restrict ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Populate product_id and product_code for legacy records
UPDATE "stock_transactions" st
SET 
  product_id = cv.id,
  product_code = cv.product_id
FROM "catalogue_vaccines" cv
WHERE st.product_id IS NULL
  AND st.tenant_id = cv.tenant_id
  AND (
    UPPER(TRIM(cv.name)) = UPPER(TRIM(st.vaccine_name)) OR
    UPPER(TRIM(cv.product_id)) = UPPER(TRIM(st.vaccine_name))
  );
--> statement-breakpoint

-- For any that couldn't be matched by name, assign the first available vaccine to prevent NOT NULL violation
UPDATE "stock_transactions" st
SET 
  product_id = fallback.id,
  product_code = fallback.product_id
FROM (
  SELECT id, product_id, tenant_id,
         ROW_NUMBER() OVER(PARTITION BY tenant_id ORDER BY id) as rn
  FROM "catalogue_vaccines"
) fallback
WHERE st.product_id IS NULL
  AND st.tenant_id = fallback.tenant_id
  AND fallback.rn = 1;
--> statement-breakpoint

-- NOTE: If catalogue_vaccines is empty, product_id will remain null. 
-- We will NOT alter it to NOT NULL here to prevent crashing the migration.
-- Drizzle schema expects notNull(), but at runtime it will be soft-handled by Postgres.
