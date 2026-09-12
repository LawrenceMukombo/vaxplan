# VaxPlan planning-gap implementation plan

## Implementation status — 9 September 2026

The planning release is implemented. The Action Register now supports microplan and community scope, supporting people, typed planning links, evidence sources, status summaries, quarterly-review adapters and supervision adapters. Consultations capture structured representation and traceable session, budget or action proposals. Barrier assessments use administrator-configurable subcategories, community scope and concrete planning links. Life-course groups carry country scope, version, eligibility attributes and overlap rules; their estimates carry geographic scope, purpose, confidence, approval and overlap reconciliation and link into session and forecast contexts. RED worksheets track completion across all ten steps, appear in Step 11 and are included in the printable plan appendix. Plan Health distinguishes review evidence, assigned actions and completed actions. Population snapshots and disaggregation ratios remain preserved through the existing wizard persistence implementation.

The optional finance, household-assessment and detailed service-review functions remain separated behind the existing programme-management switch.

## Objective

Complete the planning workflows identified in the immunization and RED guidance while preserving every existing VaxPlan workflow, data field, report, approval rule and offline behavior. Programme-management functions remain optional and are not part of the planning release.

## Current implementation assessment

| Capability | Current state | Gap to close |
|---|---|---|
| Action Register | Foundation exists with ownership, deadlines, status transitions, evidence, history, tenant scope and facility permissions. | Add microplan/community scope, supporting people, structured resource needs, consultation and microplan source types, adapters for existing supervision and quarterly-review actions, dashboard counts and Plan Health stages. |
| Community consultations | A generic planning-evidence form records facilitator, communities, participant groups, decisions, validation and proposed changes. | Replace free-text representation with structured participant-group selections and counts; record the microplan version informed; provide explicit commands to create an action, propose a session change or propose a budget line; include a consultation summary in review/print views. |
| Social and gender barriers | A generic evidence form records category, source, affected population, priority, response, owner and deadline. | Attach multiple findings to a community profile; use configurable subcategories; replace free-text planning changes with typed links to session, budget or action proposals; avoid duplicating ownership fields when an Action Register item is created. |
| Life-course groups | National admins can create age/sex/eligibility definitions and facility estimates; estimates distinguish denominator from operational target and can hold a vaccine forecast. | Move definitions to explicit country scope, add eligibility attributes that do not require code changes, geographic scope/confidence/approval to estimates, overlap rules, and connections to session targets, vaccine forecasts, costing and reports. |
| RED workflow | Ten RED steps and their operational wizard links are visible; a versioned worksheet can be attached to a draft microplan. | Add completion state and required-field checks per RED step, surface the status in the main wizard rail, and include the completed worksheet in plan review and print output. |
| Population stability | A selected denominator is stored as a snapshot and disaggregations are derived from its saved total and ratios. | Add an end-to-end navigation test proving the snapshot and all disaggregations remain unchanged through every wizard step and reopen. |
| Programme management | Generic optional records exist for finance, household assessment and service review. | Keep these behind the optional switch. Do not extend them until planning phases pass acceptance testing. |

## Compatibility rules

1. Use additive, nullable columns and new tables. Do not rename or repurpose existing fields.
2. Continue reading legacy supervision and quarterly-review actions. Present them through Action Register adapters before any data migration.
3. Write new records through the new planning services only. Existing supervision, budget, population, session and reporting endpoints retain their current request and response shapes.
4. Approved microplans stay immutable. New consultation, barrier or review evidence can reference an approved plan, but any operational change creates or informs a new draft/revision.
5. Every write remains tenant-scoped, geographically authorized, versioned and auditable.
6. Offline mutations use stable client request IDs and the existing sync queue. Replays must be idempotent.
7. New tenant settings and feature flags default off until their phase is verified. Existing screens retain current behavior when flags are off.

## Revised delivery sequence

### Phase 0 — Regression baseline and feature gates

- Capture browser tests for creating, saving, reopening, submitting, approving and viewing a routine microplan.
- Capture population snapshot values at Step 1 and assert the same values in Steps 2, 6, 9, 11 and after reopen.
- Add tenant flags for `planningActionRegister`, `participatoryPlanning` and `lifeCoursePlanning`.
- Record baseline API contracts for supervision, quarterly reviews, population, sessions, budgets and reports.

Acceptance: existing tests pass unchanged; the new flags are off by default; no existing route or screen changes when flags are off.

### Phase 1 — Shared Action Register

- Extend action records additively with nullable `microplanId`, `communityId`, supporting people and structured resource needs.
- Expand immutable source references to include consultation, barrier, microplan, quarterly review and supervision.
- Build read adapters that expose existing supervision corrective actions and quarterly-review actions in the shared register without copying them.
- Add “Create follow-up action” within supervision and quarterly review. New actions use the shared register while historical actions remain readable.
- Show open, overdue, blocked, completed and verified counts on the dashboard.
- Update Plan Health to score separately: review recorded, actions assigned and actions completed/verified.

Acceptance: every agreed action requires one owner and a valid deadline; historical supervision actions remain visible; an action remains visible until verified or explicitly cancelled; no existing supervision record changes.

### Phase 2 — Participatory planning

- Add Community Consultations inside the Demand Generation step and community profile.
- Store represented communities as IDs plus a display snapshot. Store participant categories and aggregate counts without requiring attendee identities.
- Capture issues, preferred times/locations, decisions, unresolved concerns, validation of population/maps/delivery arrangements, and the exact microplan version informed.
- Add typed proposal commands: session change, budget item and Action Register item. Applying a proposal requires review and writes through the existing destination service.
- Add configurable barrier categories and subcategories at country level.
- Allow multiple barrier findings per community, with source, date, affected population, priority and proposed response.
- Require a linked action or explicit planning decision before a high-priority barrier can be marked addressed.
- Include consultation and barrier summaries in Step 11 and the microplan print view.

Acceptance: reviewers can identify who was represented, what was agreed and which version changed; a consultation decision can create a traceable proposal; a prioritized barrier has a response, owner/deadline through Action Register, and a typed planning link.

### Phase 3 — Life-course planning

- Introduce country-scoped target-group definitions with versioned age bands, sex eligibility and configurable eligibility attributes.
- Add facility/community estimates with source, reference date, method, geographic scope, confidence, approval status and purpose.
- Define overlap relationships (`disjoint`, `contains`, `overlaps`, `unknown`) and block unsafe summation unless reconciliation is recorded.
- Let sessions select a target group and operational target without changing legacy infant-target behavior.
- Feed approved eligible denominators into vaccine/resource forecasts and budget quantities.
- Add report dimensions for target group and denominator purpose while preserving historical infant reports.

Acceptance: a national administrator can configure and publish a new target group without code changes; an approved estimate flows through session planning, forecasting, costing and reporting; overlapping groups are never silently summed.

### Phase 4 — RED completion and plan review

- Add completion state to each RED worksheet section and validate required data before marking it complete.
- Display RED status in the wizard navigation and readiness panel.
- Add consultation, barrier, target-group and Action Register completeness to Step 11.
- Render the RED worksheet and planning-evidence summaries in the printable microplan.
- Preserve the evidence snapshot linked to the submitted microplan version.

Acceptance: the approval view shows the ten RED steps, outstanding planning gaps, evidence used and owned actions; approval preserves all assumptions as an immutable version.

### Phase 5 — Optional programme management

Only after Phases 0–4 pass pilot acceptance, separately enable disbursements, expenditure, household assessments and detailed service outcomes. Their totals and indicators must remain distinct from planned budgets and administrative coverage.

## Safe rollout

For each phase: add schema and read support first; backfill only derived references that can be proven; release behind a tenant flag; test one pilot tenant; compare API contracts and core workflow screenshots; then enable additional tenants. Rollback disables the flag and leaves additive data intact. No destructive migration is required.

## Recommended next implementation slice

Start with Phase 0 and the Action Register additions in Phase 1. This establishes regression protection and a single ownership model before consultations and barriers begin generating actions. It also avoids deepening the current duplication between barrier owner/deadline fields and Action Register records.
