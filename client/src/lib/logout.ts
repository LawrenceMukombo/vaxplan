import { queryClient } from "@/lib/queryClient";
import { clearDeviceToken } from "@/lib/deviceAuth";
import { syncEngine } from "@/lib/syncEngine";
import {
  broadcastLogout,
  clearClientAuthStorage,
  completePendingServerLogout,
} from "@/lib/authSession";

interface LogoutOptions {
  reason?: string;
  message?: string;
  broadcast?: boolean;
  server?: boolean;
}

const SERVER_LOGOUT_TIMEOUT_MS = 2500;

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function sendServerLogout(reason: string): Promise<boolean> {
  if (!isOnline()) return false;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    controller && typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), SERVER_LOGOUT_TIMEOUT_MS)
      : null;

  try {
    const response = await fetch(`/api/logout?reason=${encodeURIComponent(reason)}&format=json`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });

    if (response.ok || response.status === 401 || response.status === 403) {
      completePendingServerLogout();
      return true;
    }
  } catch {
    /* Keep the pending logout marker so the app retries when connectivity returns. */
  } finally {
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
    }
  }

  return false;
}

export function flushPendingServerLogout(reason = "offline_logout"): void {
  void sendServerLogout(reason);
}

export async function performClientLogout(options: LogoutOptions = {}): Promise<void> {
  const reason = options.reason ?? "manual_logout";
  const online = isOnline();
  const shouldCallServer = options.server !== false;

  clearClientAuthStorage({
    reason,
    message:
      options.message ??
      (online
        ? "You have been signed out."
        : "You have been signed out locally. Server logout will complete when connection is restored."),
    pendingServerLogout: shouldCallServer,
  });

  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) =>
      typeof query.queryKey?.[0] === "string" &&
      (query.queryKey[0] as string).startsWith("/api"),
  });
  queryClient.setQueryData(["/api/auth/user"], null);

  syncEngine.stopForLogout();
  void clearDeviceToken();

  if (options.broadcast !== false) {
    broadcastLogout(reason);
  }

  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  if (shouldCallServer && online) {
    flushPendingServerLogout(reason);
  }
}
