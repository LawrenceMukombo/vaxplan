# Offline operation and synchronization

VaxPlan can continue selected field workflows without a network connection. Offline operation is a synchronized local replica, not an independent database and not a guarantee that every screen or mutation works offline.

## What is stored locally

The browser or packaged client uses Dexie over IndexedDB. The local store includes tenant geography, facilities, villages, clients and vaccinations, microplans, session plans and day plans, budgets, mobilization activities, stock transactions, monthly reports, population data, vaccine configuration, supervision data, catchments, cold-chain equipment, sync metadata, queued writes, and conflict records.

The active tenant identifier is stored with sync metadata. When an online user changes tenant, VaxPlan clears the previous tenant's local replica before loading the new one. If the device is offline, it avoids clearing data that cannot immediately be repopulated.

## Sign-in and offline readiness

Offline authentication is available only after a successful online session has established the required local authentication state. A first-time user or a device whose local state was cleared must connect before working offline. Shared devices should use separate operating-system accounts or an approved device procedure because IndexedDB belongs to the application profile.

Before field deployment:

1. Sign in while online with the intended tenant and account.
2. Open the required workspaces and allow the initial synchronization to finish.
3. Confirm the sync indicator shows a successful time and no stuck items.
4. Test the exact workflow in airplane mode before travel.
5. Reconnect and confirm queued work reaches the server.

## How synchronization works

Mutations supported offline are written locally and added to an outbox with tenant, method, endpoint, body, identifiers, retry count, and error details. Synchronization performs **push before pull**:

1. Acquire the outbox lease so duplicate browser contexts do not replay the same work concurrently.
2. Submit queued operations to the server batch endpoint.
3. Record server identifiers and operation-specific warnings.
4. Pull server changes since the last successful synchronization.
5. Update the local replica and the last-sync timestamp.

Sync runs after connectivity returns and on a best-effort five-minute interval while online. A manual sync can retry items that reached the automatic retry limit. The current automatic limit is five attempts.

## Conflicts and warnings

Synchronization is not described as conflict-free. The server remains authoritative when local and server records cannot be merged safely. VaxPlan retains local and server snapshots in the conflict log and exposes `/sync/conflicts` for review.

Some queued operations can succeed while returning review warnings. Examples include vaccination antigen codes that are not mapped to the tenant schedule and session changes that trigger proximity or population safeguards. Review the resulting notification instead of repeating the original operation blindly.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Offline screen is empty | Reconnect, verify the correct tenant/account, and complete an initial sync |
| Pending count does not decrease | Open the sync status, use manual retry once online, and inspect the latest error |
| Items are marked stuck | Correct authentication, validation, or reference-data errors; then use the manual retry action |
| Conflict appears | Compare local and server snapshots in Sync Conflicts and resolve according to the owning program workflow |
| Signed out while offline | Reconnect to renew authentication; do not clear site data before support reviews pending work |
| Data appears to belong to another tenant | Stop entry, reconnect, sign out/in, and escalate immediately; do not attempt manual local edits |

Do not clear browser storage, uninstall the app, reset the webview, or change tenant while unsynchronized work exists unless support has captured and accepted the risk of losing the local outbox.

## Support diagnostics

Capture the user, tenant, device/platform, last successful sync time, pending and stuck counts, affected entity, action performed, connectivity state, and visible error. Never copy client health information into an unsecured support channel.
