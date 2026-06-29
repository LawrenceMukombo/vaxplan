import { queryClient } from "@/lib/queryClient";
import { clearDeviceToken } from "@/lib/deviceAuth";
import { syncEngine } from "@/lib/syncEngine";
import {
  broadcastLogout,
  clearClientAuthStorage,
} from "@/lib/authSession";

interface LogoutOptions {
  reason?: string;
  message?: string;
  broadcast?: boolean;
  server?: boolean;
}

export async function performClientLogout(options: LogoutOptions = {}): Promise<void> {
  const reason = options.reason ?? "manual_logout";
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const shouldCallServer = options.server !== false && online;

  if (shouldCallServer) {
    try {
      await fetch(`/api/logout?reason=${encodeURIComponent(reason)}&format=json`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } catch {
      /* Local cleanup below is still authoritative for the UI. */
    }
  }

  clearClientAuthStorage({
    reason,
    message:
      options.message ??
      (online
        ? "You have been signed out."
        : "You have been signed out locally. Server logout will complete when connection is restored."),
    pendingServerLogout: !online && options.server !== false,
  });

  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) =>
      typeof query.queryKey?.[0] === "string" &&
      (query.queryKey[0] as string).startsWith("/api"),
  });
  queryClient.setQueryData(["/api/auth/user"], null);

  syncEngine.stopForLogout();
  await clearDeviceToken();

  if (options.broadcast !== false) {
    broadcastLogout(reason);
  }

  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
