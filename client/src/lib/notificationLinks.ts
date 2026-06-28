import type { Notification } from "@shared/schema";

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function readFacilityId(data: Record<string, any>): number | string | null {
  const summary = asRecord(data.summary);
  const value = data.facilityId ?? summary.facilityId ?? data.targetFacilityId;
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function addFacilityId(url: string, facilityId: number | string | null): string {
  if (!facilityId || !url.startsWith("/facilities")) return url;
  if (url.includes("facilityId=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}facilityId=${encodeURIComponent(String(facilityId))}`;
}

export function notificationHref(notification: Notification): string {
  const data = asRecord(notification.data);
  const facilityId = readFacilityId(data);
  const explicitUrl =
    typeof data.actionUrl === "string" ? data.actionUrl :
    typeof data.url === "string" ? data.url :
    typeof data.href === "string" ? data.href :
    null;

  if (explicitUrl) return addFacilityId(explicitUrl, facilityId);
  if (data.microplanId) return `/microplans/routine/${data.microplanId}`;
  if (data.sessionId) return "/all-sessions";
  if (facilityId) return `/facilities?facilityId=${encodeURIComponent(String(facilityId))}`;
  return "/notifications";
}
