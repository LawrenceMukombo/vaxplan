import type { User } from "@shared/schema";

const ACTIVE_USER_KEY = "vaxplan_active_user";
const OFFLINE_SESSION_KEY = "vaxplan_offline_auth_session";
const LOGOUT_STATE_KEY = "vaxplan_logout_state";
export const LOGOUT_BROADCAST_KEY = "vaxplan_logout_broadcast";
export const LOGOUT_CHANNEL = "vaxplan_session_sync";

const DEFAULT_OFFLINE_SESSION_MS = 72 * 60 * 60 * 1000;
const OFFLINE_KDF_ITERATIONS = 210_000;
const OFFLINE_KDF_VERSION = "pbkdf2-sha256-v1";

const OFFLINE_CREDS_KEY = "vaxplan_offline_credentials";

export interface CachedOfflineCredential {
  email: string;
  salt: string;
  passwordHash: string;
  user: User;
  tenantId?: string | null;
  tenantName?: string;
  savedAt: number;
}

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
      return Math.min(hours, 720) * 60 * 60 * 1000;
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

export function completePendingServerLogout(): void {
  const storage = safeLocalStorage();
  if (!storage) return;

  const logout = getLogoutState();
  if (!logout?.pendingServerLogout) return;

  storage.setItem(
    LOGOUT_STATE_KEY,
    JSON.stringify({
      ...logout,
      pendingServerLogout: false,
      message: logout.message ?? "You have been signed out.",
    }),
  );
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
  if ((user as any).email) {
    storage.setItem("vaxplan_last_email", String((user as any).email).toLowerCase().trim());
  }
  if ((user as any).tenantId) {
    storage.setItem("vaxplan_last_tenant_id", String((user as any).tenantId));
  }
  storage.removeItem(LOGOUT_STATE_KEY);
}

export function getValidOfflineUser(): User | null {
  const storage = safeLocalStorage();
  if (!storage) return null;

  const logout = getLogoutState();
  if (logout?.pendingServerLogout) return null;

  const session = parseJson<OfflineAuthSession>(storage.getItem(OFFLINE_SESSION_KEY));
  if (session?.user && session.userId) {
    if ((session.user as any).isActive === false) return null;
    if (Date.now() > session.expiresAt) {
      return null;
    }
    return session.user;
  }

  return null;
}

export function hasValidOfflineSession(): boolean {
  return !!getValidOfflineUser();
}

export function getCachedOfflineAccounts(): { email: string; name?: string; tenantId?: string | null }[] {
  const storage = safeLocalStorage();
  if (!storage) return [];

  const raw = storage.getItem(OFFLINE_CREDS_KEY);
  if (!raw) {
    const activeUser = parseJson<User>(storage.getItem(ACTIVE_USER_KEY));
    if (activeUser && (activeUser as any).email) {
      return [{
        email: String((activeUser as any).email).toLowerCase().trim(),
        name: (activeUser as any).fullName || (activeUser as any).username,
        tenantId: (activeUser as any).tenantId,
      }];
    }
    return [];
  }

  try {
    const creds: Record<string, CachedOfflineCredential> = JSON.parse(raw);
    return Object.values(creds).map(c => ({
      email: c.email,
      name: (c.user as any)?.fullName || (c.user as any)?.username,
      tenantId: c.tenantId || (c.user as any)?.tenantId,
    }));
  } catch {
    return [];
  }
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  if (!window.crypto?.subtle) throw new Error("Secure offline credential storage is unavailable on this device.");
  const encoder = new TextEncoder();
  const material = await window.crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: OFFLINE_KDF_ITERATIONS },
    material,
    256,
  );
  return `${OFFLINE_KDF_VERSION}:${Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function saveOfflineCredentials(
  email: string,
  password?: string | null,
  user?: User | null,
  tenantId?: string | null,
): Promise<void> {
  const storage = safeLocalStorage();
  if (!storage || !email || !password || !user?.id) return;

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const raw = storage.getItem(OFFLINE_CREDS_KEY);
    const creds: Record<string, CachedOfflineCredential> = raw ? JSON.parse(raw) : {};

    const existing = creds[normalizedEmail];
    const salt = existing?.salt || (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36));

    const passwordHash = await hashPasswordWithSalt(password, salt);
    const resolvedUser = user;

    creds[normalizedEmail] = {
      email: normalizedEmail,
      salt,
      passwordHash,
      user: resolvedUser,
      tenantId: tenantId ?? (resolvedUser as any).tenantId ?? existing?.tenantId ?? null,
      savedAt: Date.now(),
    };

    storage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
    storage.setItem("vaxplan_last_email", normalizedEmail);
    if (tenantId) storage.setItem("vaxplan_last_tenant_id", tenantId);
  } catch (err) {
    console.warn("Failed to cache offline credentials:", err);
  }
}

export async function verifyOfflineCredentials(
  email: string,
  password: string,
  tenantId?: string | null,
): Promise<{ success: boolean; user?: User; tenantId?: string | null; message?: string }> {
  const storage = safeLocalStorage();
  if (!storage) {
    return { success: false, message: "Local storage is not available for offline sign in." };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const raw = storage.getItem(OFFLINE_CREDS_KEY);
  let creds: Record<string, CachedOfflineCredential> = {};
  if (raw) {
    try {
      creds = JSON.parse(raw);
    } catch {}
  }

  const entry = creds[normalizedEmail];
  if (!entry) {
    return { success: false, message: "This account is not enrolled for offline sign in. Reconnect and sign in once on this device." };
  }

  if (!password || !entry.passwordHash || !entry.salt || !entry.passwordHash.startsWith(`${OFFLINE_KDF_VERSION}:`)) {
    return { success: false, message: "Offline credentials must be refreshed. Reconnect and sign in again." };
  }
  const testHash = await hashPasswordWithSalt(password, entry.salt);
  if (testHash !== entry.passwordHash) {
    return { success: false, message: "Incorrect password." };
  }

  clearLogoutState();
  recordOnlineAuthSession(entry.user);

  storage.setItem("vaxplan_last_email", normalizedEmail);
  const resolvedTenantId = entry.tenantId ?? (entry.user as any).tenantId ?? null;
  if (tenantId && resolvedTenantId && tenantId !== resolvedTenantId) {
    return { success: false, message: "This account is not enrolled offline for the selected country." };
  }
  if (resolvedTenantId) storage.setItem("vaxplan_last_tenant_id", resolvedTenantId);

  return {
    success: true,
    user: entry.user,
    tenantId: resolvedTenantId,
  };
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
    return "You are offline. Sign in with your account credentials to access offline microplanning.";
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
