BEGIN;
ALTER TABLE planning_evidence DROP CONSTRAINT IF EXISTS planning_evidence_kind_check;
ALTER TABLE planning_evidence ADD CONSTRAINT planning_evidence_kind_check CHECK (kind IN ('consultation','barrier','target_group','population_estimate','finance','household_assessment','service_review','red_microplanning'));
COMMIT;
