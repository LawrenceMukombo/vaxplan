import type { OutboxItem } from "./offlineDb";

export const VACCINATION_ROUTE_REPAIR_VERSION = "vaccination-route-v1";
export const OUTBOX_TELEMETRY_CLEANUP_VERSION = "microplan-version-event-v1";

/** Rows poisoned by the old broad /api/clients dispatcher are safe to retry
 * after the server route-precedence repair is deployed. */
export function isMisroutedVaccinationOutboxItem(item: OutboxItem): boolean {
  const path = item.url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return (
    item.retries >= 5 &&
    item.method === "POST" &&
    /^\/api\/clients\/[^/]+\/vaccinate(?:-batch)?$/.test(path)
  );
}

/**
 * Version events are best-effort audit snapshots, not domain mutations. Older
 * clients queued them while offline and the generic microplan replay path then
 * treated them as new plans. They can be removed without losing plan edits.
 */
export function isObsoleteOfflineTelemetryItem(item: OutboxItem): boolean {
  const path = item.url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return (
    item.method === "POST" &&
    /^\/api\/microplans\/[^/]+\/version-event$/.test(path)
  );
}

/**
 * Approval mutations cannot be replayed offline and must not poison the outbox queue.
 */
export function isObsoleteApprovalOutboxItem(item: OutboxItem): boolean {
  const path = item.url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return /^\/api\/approvals(?:\/|$)/.test(path);
}

