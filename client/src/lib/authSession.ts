import type { User } from "@shared/schema";

const ACTIVE_USER_KEY = "vaxplan_active_user";
const OFFLINE_SESSION_KEY = "vaxplan_offline_auth_session";
const LOGOUT_STATE_KEY = "vaxplan_logout_state";
export const LOGOUT_BROADCAST_KEY = "vaxplan_logout_broadcast";
export const LOGOUT_CHANNEL = "vaxplan_session_sync";

const DEFAULT_OFFLINE_SESSION_MS = 8 * 60 * 60 * 1000;

interface OfflineAuthSession {
  user: User;
  userId: string;
  tenantId: string | null;
  role: string | null;
  roles: string[];
  dataAccessScope: unknown;
  issuedAt: number;
  expiresAt: number;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function offlineSessionWindowMs(): number {
  const storage = safeLocalStorage();
  const saved = storage?.getItem("vaxplan_offline_session_hours");
  if (saved) {
    const hours = Number(saved);
    if (Number.isFinite(hours) && hours > 0) {
      return Math.min(hours, 24) * 60 * 60 * 1000;
    }
  }
  return DEFAULT_OFFLINE_SESSION_MS;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getLogoutState(): { reason?: string; message?: string; at?: number; pendingServerLogout?: boolean } | null {
  return parseJson(safeLocalStorage()?.getItem(LOGOUT_STATE_KEY) ?? null);
}

export function clearLogoutState(): void {
  safeLocalStorage()?.removeItem(LOGOUT_STATE_KEY);
}

export function recordOnlineAuthSession(user: User | null | undefined): void {
  const storage = safeLocalStorage();
  if (!storage || !user?.id) return;

  const now = Date.now();
  const session: OfflineAuthSession = {
    user,
    userId: String(user.id),
    tenantId: (user as any).tenantId ?? null,
    role: (user as any).role ?? null,
    roles: Array.isArray((user as any).roles) ? (user as any).roles : [],
    dataAccessScope: (user as any).dataAccessScope ?? null,
    issuedAt: now,
    expiresAt: now + offlineSessionWindowMs(),
  };

  storage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
  storage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  storage.removeItem(LOGOUT_STATE_KEY);
}

export function getValidOfflineUser(): User | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  if (storage.getItem(LOGOUT_STATE_KEY)) return null;

  const session = parseJson<OfflineAuthSession>(storage.getItem(OFFLINE_SESSION_KEY));
  if (!session?.user || !session.userId || !session.expiresAt) return null;
  if (Date.now() > session.expiresAt) return null;
  if ((session.user as any).isActive === false) return null;
  return session.user;
}

export function hasValidOfflineSession(): boolean {
  return !!getValidOfflineUser();
}

export function getOfflineAuthMessage(): string {
  const storage = safeLocalStorage();
  if (!storage) return "Sign in to continue.";
  const logout = getLogoutState();
  if (logout?.pendingServerLogout) {
    return "You have been signed out locally. Server logout will complete when connection is restored.";
  }
  if (logout) return logout.message || "You are signed out. Reconnect to sign in.";

  const session = parseJson<OfflineAuthSession>(storage.getItem(OFFLINE_SESSION_KEY));
  if (session?.expiresAt && Date.now() > session.expiresAt) {
    return "Offline session expired. Please reconnect and sign in again.";
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You are offline. Sign in online once on this device to enable offline access.";
  }
  return "Sign in to your VaxPlan account to continue.";
}

export function clearClientAuthStorage(options: {
  reason?: string;
  message?: string;
  pendingServerLogout?: boolean;
} = {}): void {
  const storage = safeLocalStorage();
  if (!storage) return;

  storage.removeItem(ACTIVE_USER_KEY);
  storage.removeItem(OFFLINE_SESSION_KEY);
  storage.removeItem("vaxplan_active_tenant");

  storage.setItem(
    LOGOUT_STATE_KEY,
    JSON.stringify({
      reason: options.reason ?? "logout",
      message: options.message ?? "You have been signed out.",
      pendingServerLogout: !!options.pendingServerLogout,
      at: Date.now(),
    }),
  );

  try {
    window.sessionStorage.removeItem(ACTIVE_USER_KEY);
    window.sessionStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function broadcastLogout(reason = "logout"): void {
  if (typeof window === "undefined") return;
  const payload = { type: "LOGOUT_NOW", reason, at: Date.now() };
  try {
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LOGOUT_BROADCAST_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
