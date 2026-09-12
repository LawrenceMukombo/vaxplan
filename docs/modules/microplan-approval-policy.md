# Microplan approval policy

Approved and automatically approved microplans are read-only for every role, including district, national and platform administrators. General edits, deletion, resubmission and version restoration cannot reopen an approved plan. Create a new draft for revised planning. Offline microplan edits are restricted to drafts and cannot change approval status.

The wizard does not autosave a saved plan until its status is loaded and confirmed as draft. Read-only plans disable authoring controls. The API and persistence layer enforce approval locks independently of the browser.

## Development period

In **Settings → country configuration**, set **Minimum plan development days** next to Maximum Approval Level. The default and minimum are 21; whole numbers through 3650 are accepted. The country setting is `minimumPlanDevelopmentDays`.

The waiting period runs from the server-recorded creation timestamp. For example, a plan created on September 1 at 12:00 becomes eligible on September 22 at 12:00 with a 21-day setting. This measures elapsed development time, not days before the first session and not accumulated editing activity. Existing session scheduling lead-time rules remain in effect.

Manual approvals and both automatic approval jobs check the development period. Existing automatic-approval inactivity periods also apply. The wizard displays the earliest approval timestamp. Missing or invalid creation dates block approval. API edits cannot replace the creation timestamp.

## Connection fix and verification

REST authentication and WebSockets now receive the same session middleware instance. Previously, local in-memory stores could differ, causing authenticated REST users to fail WebSocket authentication.

Verified with TypeScript, policy/persistence/version/evidence tests, an isolated authenticated WebSocket handshake and isolated frontend/server production builds. The reported unmapped-community query succeeded against the current local database; its earlier 500 was not reproduced. No application records were changed during these checks. Restart the running application to load the source changes; existing distribution files were not replaced.
