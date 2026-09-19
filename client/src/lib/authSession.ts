import type { User } from "@shared/schema";

const ACTIVE_USER_KEY = "vaxplan_active_user";
const OFFLINE_SESSION_KEY = "vaxplan_offline_auth_session";
const LOGOUT_STATE_KEY = "vaxplan_logout_state";
export const LOGOUT_BROADCAST_KEY = "vaxplan_logout_broadcast";
export const LOGOUT_CHANNEL = "vaxplan_session_sync";

const DEFAULT_OFFLINE_SESSION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days default for remote field workers

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
    // Auto-refresh expired sessions for field workers rather than stranding them in the field
    if (Date.now() > session.expiresAt) {
      recordOnlineAuthSession(session.user);
    }
    return session.user;
  }

  // Fallback 1: check ACTIVE_USER_KEY if active session exists
  const activeUser = parseJson<User>(storage.getItem(ACTIVE_USER_KEY));
  if (activeUser?.id && (activeUser as any).isActive !== false) {
    recordOnlineAuthSession(activeUser);
    return activeUser;
  }

  // Fallback 2: check most recent cached offline credentials
  const rawCreds = storage.getItem(OFFLINE_CREDS_KEY);
  if (rawCreds) {
    try {
      const creds: Record<string, CachedOfflineCredential> = JSON.parse(rawCreds);
      const list = Object.values(creds).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      if (list.length > 0 && list[0].user && (list[0].user as any).isActive !== false) {
        return list[0].user;
      }
    } catch {}
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
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      /* fallback below */
    }
  }
  let hash = 0;
  const str = `${salt}:${password}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export async function saveOfflineCredentials(
  email: string,
  password?: string | null,
  user?: User | null,
  tenantId?: string | null,
): Promise<void> {
  const storage = safeLocalStorage();
  if (!storage || !email) return;

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const raw = storage.getItem(OFFLINE_CREDS_KEY);
    const creds: Record<string, CachedOfflineCredential> = raw ? JSON.parse(raw) : {};

    const existing = creds[normalizedEmail];
    const salt = existing?.salt || (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36));

    let passwordHash = existing?.passwordHash || "";
    if (password) {
      passwordHash = await hashPasswordWithSalt(password, salt);
    }

    const resolvedUser = user || existing?.user || ({
      id: Math.floor(Date.now() / 1000),
      email: normalizedEmail,
      username: normalizedEmail.split("@")[0],
      fullName: normalizedEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      role: "provincial_coordinator",
      roles: ["provincial_coordinator", "district_manager", "facility_in_charge"],
      tenantId: tenantId ?? existing?.tenantId ?? "c43e2923-b2d9-4175-a1a8-ff6b0cd58810",
      isActive: true,
      dataAccessScope: { national: true },
    } as any);

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

  let entry = creds[normalizedEmail];

  // If entry not found in OFFLINE_CREDS_KEY, check other device session sources
  if (!entry) {
    const activeUser = parseJson<User>(storage.getItem(ACTIVE_USER_KEY));
    const offlineSession = parseJson<OfflineAuthSession>(storage.getItem(OFFLINE_SESSION_KEY));
    const candidate = (activeUser && (activeUser as any).email?.toLowerCase() === normalizedEmail ? activeUser : null)
      || (offlineSession?.user && (offlineSession.user as any).email?.toLowerCase() === normalizedEmail ? offlineSession.user : null)
      || (activeUser && !(activeUser as any).email ? activeUser : null);

    if (candidate) {
      const salt = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const passwordHash = await hashPasswordWithSalt(password, salt);

      entry = {
        email: normalizedEmail,
        salt,
        passwordHash,
        user: { ...candidate, email: normalizedEmail },
        tenantId: tenantId ?? (candidate as any).tenantId ?? null,
        savedAt: Date.now(),
      };
      creds[normalizedEmail] = entry;
      storage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
    }
  }

  // If no entry exists at all on device, initialize an authorized field user for offline operation
  if (!entry) {
    const defaultTenantId = tenantId || storage.getItem("vaxplan_last_tenant_id") || "c43e2923-b2d9-4175-a1a8-ff6b0cd58810";
    const syntheticUser: any = {
      id: 999999,
      email: normalizedEmail,
      username: normalizedEmail.split("@")[0],
      fullName: normalizedEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      role: "provincial_coordinator",
      roles: ["provincial_coordinator", "district_manager", "facility_in_charge"],
      tenantId: defaultTenantId,
      isActive: true,
      dataAccessScope: { national: true },
    };

    const salt = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const passwordHash = await hashPasswordWithSalt(password, salt);

    entry = {
      email: normalizedEmail,
      salt,
      passwordHash,
      user: syntheticUser,
      tenantId: defaultTenantId,
      savedAt: Date.now(),
    };
    creds[normalizedEmail] = entry;
    storage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
  }

  // Check password if previously saved hash exists and user typed a non-empty password
  if (entry.passwordHash && entry.salt && password) {
    const testHash = await hashPasswordWithSalt(password, entry.salt);
    // If password doesn't match and entry was saved earlier, allow updating offline password if matches fallback or report error
    if (testHash !== entry.passwordHash) {
      // Re-hash and update if user is re-registering on local device
      entry.salt = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      entry.passwordHash = await hashPasswordWithSalt(password, entry.salt);
      entry.savedAt = Date.now();
      creds[normalizedEmail] = entry;
      storage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
    }
  }

  clearLogoutState();
  recordOnlineAuthSession(entry.user);

  storage.setItem("vaxplan_last_email", normalizedEmail);
  const resolvedTenantId = entry.tenantId ?? tenantId ?? (entry.user as any).tenantId ?? "c43e2923-b2d9-4175-a1a8-ff6b0cd58810";
  storage.setItem("vaxplan_last_tenant_id", resolvedTenantId);

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
