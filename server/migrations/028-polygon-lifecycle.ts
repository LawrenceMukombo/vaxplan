import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function applyPolygonLifecycleMigration(db: NodePgDatabase<any>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE gis_polygons
      ADD COLUMN IF NOT EXISTS previous_version_id integer,
      ADD COLUMN IF NOT EXISTS replaced_version_id integer,
      ADD COLUMN IF NOT EXISTS parent_facility_id integer,
      ADD COLUMN IF NOT EXISTS valid_from timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS valid_to timestamp,
      ADD COLUMN IF NOT EXISTS change_type varchar(50) DEFAULT 'created',
      ADD COLUMN IF NOT EXISTS change_reason text,
      ADD COLUMN IF NOT EXISTS submitted_by varchar(255),
      ADD COLUMN IF NOT EXISTS submitted_at timestamp,
      ADD COLUMN IF NOT EXISTS rejection_reason text,
      ADD COLUMN IF NOT EXISTS metadata_json jsonb DEFAULT '{}'::jsonb
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_gis_polygons_owner_version
      ON gis_polygons (tenant_id, owner_type, owner_id, version DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_gis_polygons_parent_facility
      ON gis_polygons (tenant_id, parent_facility_id)
  `);
  await db.execute(sql`
    WITH ranked_active AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY tenant_id, owner_type, owner_id, polygon_type
               ORDER BY COALESCE(version, 1) DESC, COALESCE(updated_at, created_at, now()) DESC, id DESC
             ) AS active_rank
        FROM gis_polygons
       WHERE is_active = true AND status = 'active'
    )
    UPDATE gis_polygons AS polygon
       SET status = 'replaced',
           is_active = false,
           valid_to = COALESCE(polygon.valid_to, now()),
           change_type = COALESCE(polygon.change_type, 'legacy_duplicate_resolved'),
           metadata_json = COALESCE(polygon.metadata_json, '{}'::jsonb)
             || jsonb_build_object('migrationResolution', 'duplicate active version retained as replaced')
      FROM ranked_active
     WHERE polygon.id = ranked_active.id
       AND ranked_active.active_rank > 1
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gis_polygons_one_active_owner
      ON gis_polygons (tenant_id, owner_type, owner_id, polygon_type)
      WHERE is_active = true AND status = 'active'
  `);

  await db.execute(sql`
    UPDATE gis_polygons
       SET version = COALESCE(version, 1),
           valid_from = COALESCE(valid_from, created_at, now()),
           change_type = COALESCE(change_type, 'created'),
           metadata_json = COALESCE(metadata_json, '{}'::jsonb)
     WHERE version IS NULL
        OR valid_from IS NULL
        OR change_type IS NULL
        OR metadata_json IS NULL
  `);
}
