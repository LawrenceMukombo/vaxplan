/**
 * server/errorUtils.ts
 *
 * Central error-sanitization helpers for VaxPlan.
 *
 * In production, internal errors (database failures, connection resets, OOM,
 * etc.) are replaced with a safe generic message so infrastructure details
 * never leak to the browser.  In development, the real message is preserved
 * for debugging convenience.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Patterns that indicate an internal/infrastructure error whose message
 * must NEVER be sent to users.  These are matched case-insensitively
 * against `err.message`.
 */
const INTERNAL_ERROR_PATTERNS: RegExp[] = [
  /password authentication failed/i,
  /connection refused/i,
  /connection terminated/i,
  /connection reset/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EHOSTUNREACH/i,
  /ENOTFOUND/i,
  /no pg_hba\.conf entry/i,
  /SSL\s+connection/i,
  /remaining connection slots/i,
  /too many connections/i,
  /database .* does not exist/i,
  /role .* does not exist/i,
  /could not connect to server/i,
  /the database system is .* shutting down/i,
  /canceling statement due to/i,
  /out of memory/i,
  /disk full/i,
  /cannot allocate memory/i,
  /segmentation fault/i,
  /ENOMEM/i,
];

/**
 * Returns `true` if the error looks like an internal/infrastructure error
 * that must NOT be exposed to end-users.
 */
export function isInternalError(err: unknown): boolean {
  if (!err) return false;
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as any).message)
      : typeof err === "string"
        ? err
        : "";
  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Returns a safe, user-facing error message.
 *
 * - If the error is an internal/infrastructure error **and** we are in
 *   production, the `fallback` message is returned instead.
 * - In development, the real `err.message` is always returned (with the
 *   fallback as a last resort) so engineers can debug.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
  const rawMessage =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as any).message)
      : typeof err === "string"
        ? err
        : "";

  // Always hide internal errors in production
  if (process.env.NODE_ENV === "production" && isInternalError(err)) {
    return fallback;
  }

  // All unexpected production errors use the route-specific safe fallback.
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  // Development: show the real message for debugging
  return rawMessage || fallback;
}
