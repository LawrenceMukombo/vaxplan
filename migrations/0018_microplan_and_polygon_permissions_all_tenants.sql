WITH permission_catalog(code, name, description) AS (
  VALUES
    ('microplan.view_history', 'View Microplan History', 'View immutable microplan lifecycle versions.'),
    ('microplan.compare_versions', 'Compare Microplan Versions', 'Compare two microplan snapshots.'),
    ('microplan.return_for_correction', 'Return Microplans', 'Return a submitted microplan to its author for correction.'),
    ('microplan.restore_version', 'Restore Microplan Versions', 'Restore a historical microplan snapshot as a new draft.'),
    ('microplan.rebaseline', 'Rebaseline Microplans', 'Create a controlled new baseline from an approved microplan.'),
    ('microplan.view_audit', 'View Microplan Audit', 'View microplan version and workflow audit evidence.'),
    ('microplan.export_version', 'Export Microplan Versions', 'Export a selected immutable microplan version.'),
    ('polygon.view', 'View Polygons', 'View official and draft polygons within assigned scope.'),
    ('polygon.create', 'Create Polygons', 'Create draft polygons within assigned scope.'),
    ('polygon.edit', 'Edit Polygons', 'Create versioned polygon corrections within assigned scope.'),
    ('polygon.delete_draft', 'Delete Draft Polygons', 'Delete polygon drafts that have never become active.'),
    ('polygon.archive', 'Archive Polygons', 'Archive polygons while preserving history.'),
    ('polygon.replace', 'Replace Polygons', 'Propose replacement polygon geometry.'),
    ('polygon.approve', 'Approve Polygon Changes', 'Approve or return polygon versions.'),
    ('polygon.override_validation', 'Override Polygon Warnings', 'Approve polygon warnings with a reason.'),
    ('polygon.view_history', 'View Polygon History', 'View polygon versions.'),
    ('polygon.compare_versions', 'Compare Polygon Versions', 'Compare polygon versions and impact.'),
    ('polygon.recalculate_population', 'Recalculate Polygon Population', 'Recalculate population for a polygon version.')
)
INSERT INTO user_permissions (tenant_id, code, name, description, created_at, updated_at)
SELECT t.id, p.code, p.name, p.description, now(), now()
FROM tenants t CROSS JOIN permission_catalog p
ON CONFLICT (tenant_id, code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();

WITH role_additions(code, additions) AS (
  VALUES
    ('facility_clerk', '["microplan.view_history","microplan.compare_versions"]'::jsonb),
    ('facility_in_charge', '["microplan.view_history","microplan.compare_versions"]'::jsonb),
    ('district_manager', '["microplan.view_history","microplan.compare_versions","microplan.return_for_correction"]'::jsonb),
    ('provincial_coordinator', '["microplan.view_history","microplan.compare_versions","microplan.return_for_correction"]'::jsonb),
    ('national_admin', '["microplan.view_history","microplan.compare_versions","microplan.return_for_correction","microplan.restore_version","microplan.rebaseline","microplan.view_audit","microplan.export_version","polygon.view","polygon.create","polygon.edit","polygon.delete_draft","polygon.archive","polygon.replace","polygon.approve","polygon.override_validation","polygon.view_history","polygon.compare_versions","polygon.recalculate_population"]'::jsonb)
)
UPDATE user_roles r
SET permissions = (
  SELECT jsonb_agg(DISTINCT permission)
  FROM jsonb_array_elements(COALESCE(r.permissions, '[]'::jsonb) || a.additions) AS permission
), updated_at = now()
FROM role_additions a
WHERE r.code = a.code;
