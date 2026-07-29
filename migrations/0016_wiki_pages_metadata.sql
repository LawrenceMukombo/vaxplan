ALTER TABLE IF EXISTS "wiki_pages"
  ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Uncategorized';

ALTER TABLE IF EXISTS "wiki_pages"
  ADD COLUMN IF NOT EXISTS "gamification" jsonb DEFAULT '{}'::jsonb;
