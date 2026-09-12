BEGIN;
CREATE TABLE IF NOT EXISTS planning_evidence (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES tenants(id),
  facility_id integer NOT NULL REFERENCES facilities(id),
  kind varchar(40) NOT NULL CHECK (kind IN ('consultation','barrier','target_group','population_estimate','finance','household_assessment','service_review')),
  microplan_id integer REFERENCES microplans(id),
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS planning_evidence_scope_idx ON planning_evidence(tenant_id,facility_id,kind);
CREATE TABLE IF NOT EXISTS planning_evidence_history (
  evidence_id uuid NOT NULL REFERENCES planning_evidence(id),
  version integer NOT NULL,
  payload jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by varchar NOT NULL REFERENCES users(id),
  PRIMARY KEY(evidence_id,version)
);
COMMIT;
