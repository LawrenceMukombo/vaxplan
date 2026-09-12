# Phased planning extension implementation

## Compatibility contract

- Preserve existing routes, approvals, forecasts, population columns and supervision records.
- Add new tables with explicit migrations; do not run schema push or modify production data automatically.
- Use existing tenant and geographic authorization on every read and write.
- Preserve approved microplan snapshots. New evidence must not silently change approved plans.
- Validate each phase before enabling it. Existing uncommitted risk-module and distribution changes are outside this work.

## Delivery phases

1. Shared action register: validated lifecycle, accountable owner, deadline, evidence, optimistic concurrency and audit history; link reviews and supervision without rewriting legacy records.
2. Community consultations and barrier-response planning, with participant representation and traceable planning decisions.
3. Configurable life-course target groups and estimates, distinguishing denominators from operational targets and overlapping groups.
4. Optional commitments, receipts and expenditure against existing budget items.
5. Optional household assessments and service outcomes, keeping survey evidence separate from administrative coverage and reusing vaccination records.

## Verification

Establish baseline TypeScript diagnostics; test validation, lifecycle transitions, tenant/geographic isolation, concurrency and compatibility. Build to a separate output directory to preserve the existing distribution. Record phase completion and deployment prerequisites here.
