-- Explicit, additive migration. Existing tables and records are not modified.
BEGIN;
CREATE TABLE IF NOT EXISTS planning_actions (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES tenants(id),
  facility_id integer NOT NULL REFERENCES facilities(id),
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS planning_actions_scope_idx ON planning_actions(tenant_id, facility_id);
CREATE TABLE IF NOT EXISTS planning_action_history (
  action_id uuid NOT NULL REFERENCES planning_actions(id),
  version integer NOT NULL,
  payload jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by varchar NOT NULL REFERENCES users(id),
  PRIMARY KEY(action_id, version)
);
COMMIT;
