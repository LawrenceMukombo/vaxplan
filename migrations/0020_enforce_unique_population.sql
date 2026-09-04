-- 0020_enforce_unique_population.sql
-- Enforce that there is ONLY ONE population record per geographic entity per year per source.

-- 1. Deduplicate village-level population records
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, village_id, year, source
           ORDER BY 
             (CASE WHEN under_5_population IS NOT NULL AND under_5_population > 0 THEN 1 ELSE 0 END) DESC,
             (CASE WHEN under_1_population IS NOT NULL AND under_1_population > 0 THEN 1 ELSE 0 END) DESC,
             (CASE WHEN total_population > 0 THEN 1 ELSE 0 END) DESC,
             updated_at DESC NULLS LAST,
             id DESC
         ) as rn
  FROM population_data
  WHERE village_id IS NOT NULL
)
DELETE FROM population_data
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

-- 2. Deduplicate facility-level population records
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, facility_id, year, source
           ORDER BY 
             (CASE WHEN under_5_population IS NOT NULL AND under_5_population > 0 THEN 1 ELSE 0 END) DESC,
             (CASE WHEN under_1_population IS NOT NULL AND under_1_population > 0 THEN 1 ELSE 0 END) DESC,
             (CASE WHEN total_population > 0 THEN 1 ELSE 0 END) DESC,
             updated_at DESC NULLS LAST,
             id DESC
         ) as rn
  FROM population_data
  WHERE village_id IS NULL AND facility_id IS NOT NULL
)
DELETE FROM population_data
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

-- 3. Deduplicate district-level population records
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, district_id, year, source
           ORDER BY 
             (CASE WHEN total_population > 0 THEN 1 ELSE 0 END) DESC,
             updated_at DESC NULLS LAST,
             id DESC
         ) as rn
  FROM population_data
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NOT NULL
)
DELETE FROM population_data
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

-- 4. Deduplicate province-level population records
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, province_id, year, source
           ORDER BY 
             (CASE WHEN total_population > 0 THEN 1 ELSE 0 END) DESC,
             updated_at DESC NULLS LAST,
             id DESC
         ) as rn
  FROM population_data
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NULL AND province_id IS NOT NULL
)
DELETE FROM population_data
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

-- 5. Deduplicate national/unscoped population records
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, year, source
           ORDER BY 
             (CASE WHEN total_population > 0 THEN 1 ELSE 0 END) DESC,
             updated_at DESC NULLS LAST,
             id DESC
         ) as rn
  FROM population_data
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NULL AND province_id IS NULL
)
DELETE FROM population_data
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS uq_pop_village_year_source
  ON population_data (tenant_id, village_id, year, source)
  WHERE village_id IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS uq_pop_facility_year_source
  ON population_data (tenant_id, facility_id, year, source)
  WHERE village_id IS NULL AND facility_id IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS uq_pop_district_year_source
  ON population_data (tenant_id, district_id, year, source)
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS uq_pop_province_year_source
  ON population_data (tenant_id, province_id, year, source)
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NULL AND province_id IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS uq_pop_national_year_source
  ON population_data (tenant_id, year, source)
  WHERE village_id IS NULL AND facility_id IS NULL AND district_id IS NULL AND province_id IS NULL;
