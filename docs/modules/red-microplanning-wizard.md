# RED microplanning in the wizard

The wizard includes an expandable **RED microplanning: 10-step worksheet** after a facility microplan has been saved. It follows Part 1 of `Microplanning_RED.pdf`, starting at PDF page 13 / printed page 9. Existing operational steps and their persistence paths retain their numbering and behavior.

| RED step | Captured planning data | Existing operational step |
| --- | --- | --- |
| 1. Quantitative analysis | Community, 12-month dates, sources, infant and maternal denominators, first/third/measles/Td doses, thresholds, priority and reconciliation | 1 |
| 2. Operational map | Settlements, population groups, map references, routes, distance/time, transport, seasonal access, nomadic movement, session site and map review | 2 |
| 3. Special activities | Priority, problem category, hard-to-reach status, previous contacts, facility actions, district support and integrated interventions | 3 |
| 4. Session plan | Group and population, strategy, national workload assumptions, staff capacity, annual/monthly injection workload, estimated and agreed frequency | 4 |
| 5. RED problem solving | Five RED components, evidence, local/district activities, area, owner, deadline and action reference | 3 |
| 6. Quarterly workplan | Session and non-session activities, dates, owner, transport, district support, integrated interventions and scheduling conflicts | 4 |
| 7. Monitoring | Annual/monthly targets, vaccine pair, chart reference, update owner/frequency and action triggers | 12 |
| 8. Community and defaulters | Representatives, consultation, preferences, feedback, reported barriers, newborn/pregnancy reporting, notifications and tracking responsibilities | 7 |
| 9. Supplies | Presentation, minimum/quarterly/maximum stock, forecast reference, verification owner/frequency, VVM/expiry checks and replenishment plan | 6 |
| 10. Monthly reports | Owner, deadline, recipient, source references, supervision, missed/replanned sessions, solved/outstanding problems and review actions | 12 |

## Saving and interpretation

Use **Save RED worksheet** explicitly; the wizard's Save/Next saves operational fields separately. Select a saved worksheet to reopen its values. The existing planning-evidence API supplies tenant/facility permissions, revision history, optimistic concurrency and idempotent creation. The server requires a saved draft microplan for RED worksheet writes. Approved plans retain readable worksheets.

Rows can be incomplete during planning; blank numeric values remain unknown rather than zero. Calculations use entered assumptions and preserve negative unimmunized estimates or coverage above 100% for reconciliation. Local thresholds are entered explicitly, and TT/Td uses a separate maternal denominator. Session workload estimates are advisory and do not generate calendar entries or overwrite vaccine forecasts. Population overlap and priority ranks require planner review.

Apply agreed findings in the linked operational step. Track completion and action history in the action register. Existing consultation, barrier and life-course records remain in Planning Evidence. The worksheet captures references to maps, charts and operational records; it does not replace those tools or automatically import their data. It does not enforce worksheet completion as an approval gate. Offline autosync is not provided for this worksheet.

## Rollout and validation

Apply `migrations/red-microplanning-additive.sql` after the planning-evidence migration. It expands the existing kind constraint without deleting records or changing their payloads. The local rollout helper includes it; external deployments should apply it through their normal migration process before serving the new code.

Validated with TypeScript, RED calculation/date tests, existing evidence route tests plus RED draft-lock coverage, and an isolated browser test that creates, saves and reloads a worksheet across all ten navigation entries. Build output is isolated under scratch to preserve the running app and existing distribution files.
