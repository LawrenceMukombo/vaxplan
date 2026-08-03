CREATE TABLE IF NOT EXISTS microplan_versions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  microplan_id integer NOT NULL REFERENCES microplans(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label varchar(50) NOT NULL,
  event_type varchar(50) NOT NULL,
  status varchar(50) NOT NULL,
  reason text,
  snapshot jsonb NOT NULL,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_microplan_versions_plan_number UNIQUE (microplan_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_microplan_versions_tenant_plan
  ON microplan_versions (tenant_id, microplan_id, version_number DESC);
