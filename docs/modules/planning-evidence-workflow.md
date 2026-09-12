# Planning evidence and action register

## Initial phased rollout

The extension adds two workspaces: **Planning Actions** and **Planning Evidence**. Both are linked from routine planning navigation, Plan Health and the microplan wizard. Wizard links open separately so an unsaved plan is not abandoned.

### Phase 1: actions

Create proposals, agree an accountable owner and deadline, record progress or a blocking reason, and attach completion evidence. A different reviewer with microplan review permission verifies completion. Stale edits are rejected instead of overwriting another user's revision. Cancellation retains the record and its history.

Actions can reference an existing quarterly review, supervision visit or planning-evidence record in the same facility. Existing supervision follow-up remains unchanged and is displayed separately, with an explicit option to track it in the register. Tracking does not synchronize status back into the older supervision text field.

### Phase 2: community consultation and barriers

Record represented communities and participant groups, actual attendance, issues, preferred session times/locations, decisions, unresolved concerns and community validation. Barrier records capture evidence, affected populations, category, priority, response, owner and deadline. Use **Plan follow-up** to create a linked action.

Evidence may be associated with a microplan, but does not automatically change its approved content. Session and budget changes continue through existing planning and approval workflows.

### Phase 3: life-course groups

Country administrators create group definitions with age ranges, sex eligibility, other criteria and overlap notes. Active definitions are available to facilities in the country. Published age/eligibility definitions cannot be rewritten; retire and replace them to preserve interpretation of historical estimates.

Facilities record group estimates, reference dates, source, method, confidence, reconciliation notes and whether the value is an eligible denominator or an operational target. Groups are not automatically summed because they may overlap.

The resource forecast uses explicit coverage, doses per person, vial size, wastage and session-capacity assumptions. Forecast assumptions are saved in the estimate's revision history and can be exported. Existing population columns, vaccine requirements and calculator totals are unchanged; adoption into the operational microplan remains an explicit planning step.

### Phase 4: optional financial records

Enable the programme-management sections in Planning Evidence. Record commitments, receipts, expenditure and in-kind contributions against an existing facility budget line. Amounts use a fixed two-decimal accounting representation. Summaries separate currencies and exclude commitments/in-kind support from cash available. Corrections require an explanation and preserve prior revisions.

This is a supplementary activity-finance record, not an accounting/payment system. It does not execute payments, perform exchange-rate conversion or automatically reconcile bank statements.

### Phase 5: optional field evidence

Household assessments record consent, a non-identifying household code, sampling method, card observations, vaccination-status counts, reported barriers and reconciliation notes. Counts must reconcile. These records do not create population coverage estimates or implement statistical sampling designs.

Service reviews link an existing session to attendance, delivery status, other services, reasons for partial/missed delivery and follow-up needs. Vaccine administrations continue to be recorded through the existing session/client workflows; they are not duplicated here.

## Offline behavior

Use **Save device draft** before leaving an unfinished form. Drafts are scoped to the signed-in user, active country, facility and section. Restore and submit when connected. Submission checks permissions and record versions again. These new records do not use the legacy automatic outbox; automatic background synchronization is not part of this initial rollout. Remove device drafts when no longer needed.

## Compatibility and rollout

- The new tables are declared in `shared/schema.ts` and created by explicit additive SQL migrations.
- The local migration helper defaults to a dry run and rejects remote database URLs.
- Local tables were created only after a successful transactional dry run. Persistence checks insert new test records and roll them back.
- No existing records, approved-plan snapshots, risk-module changes or distribution files are replaced.
- Deploy the source and migrations together through the normal release process. Existing running processes were not restarted and the existing distribution was not rebuilt in place.

Commands from the repository root:

```powershell
node --env-file=.env --import tsx scripts/migrate-planning-extensions.ts
node --env-file=.env --import tsx scripts/migrate-planning-extensions.ts --apply
```

## Verification

Focused tests cover lifecycle validation, calendar dates, required evidence, tenant/facility boundaries, source validation, stale versions, independent verification, financial summaries, assessment-count reconciliation and forecast arithmetic. Browser checks exercise consultation saving and action validation/saving with isolated fixtures. The client production bundle is built into a separate scratch directory; server bundling and TypeScript checks do not replace the working distribution.
