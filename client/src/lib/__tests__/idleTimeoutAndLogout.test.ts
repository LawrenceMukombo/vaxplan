import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearClientAuthStorage,
  getLogoutState,
  broadcastLogout,
  LOGOUT_BROADCAST_KEY,
} from "@/lib/authSession";
import { performClientLogout } from "@/lib/logout";

class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
}

const mockStorage = new MemoryStorage();
const mockSession = new MemoryStorage();

(globalThis as any).window = {
  localStorage: mockStorage,
  sessionStorage: mockSession,
  location: { pathname: "/dashboard", search: "" },
  history: { replaceState: vi.fn() },
  dispatchEvent: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true, configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: mockSession, writable: true, configurable: true });

describe("Session Management, Idle Timeout & Logout", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSession.clear();
    vi.clearAllMocks();
  });

  it("should record proper logout state upon manual sign out", () => {
    clearClientAuthStorage({
      reason: "manual_logout",
      message: "You have been signed out.",
    });

    const state = getLogoutState();
    expect(state).not.toBeNull();
    expect(state?.reason).toBe("manual_logout");
    expect(state?.message).toBe("You have been signed out.");
    expect(state?.pendingServerLogout).toBe(false);
  });

  it("should record proper logout state upon idle timeout", () => {
    clearClientAuthStorage({
      reason: "idle_timeout",
      message: "Session expired. Please sign in again.",
    });

    const state = getLogoutState();
    expect(state).not.toBeNull();
    expect(state?.reason).toBe("idle_timeout");
    expect(state?.message).toBe("Session expired. Please sign in again.");
  });

  it("should broadcast logout across storage and channel", () => {
    broadcastLogout("idle_timeout");

    const broadcastRaw = localStorage.getItem(LOGOUT_BROADCAST_KEY);
    expect(broadcastRaw).not.toBeNull();
    const broadcast = JSON.parse(broadcastRaw!);
    expect(broadcast.type).toBe("LOGOUT_NOW");
    expect(broadcast.reason).toBe("idle_timeout");
    expect(typeof broadcast.at).toBe("number");
  });

  it("should clear active user and sync state on performClientLogout", async () => {
    localStorage.setItem("vaxplan_active_user", JSON.stringify({ id: "user-1", email: "test@vaxplan.org" }));
    localStorage.setItem("vaxplan_active_tenant", "tenant-1");

    await performClientLogout({
      reason: "manual_logout",
      server: false,
    });

    expect(localStorage.getItem("vaxplan_active_user")).toBeNull();
    expect(localStorage.getItem("vaxplan_active_tenant")).toBeNull();

    const logoutState = getLogoutState();
    expect(logoutState?.reason).toBe("manual_logout");
  });

  it("should navigate to /login and preserve previous location in sessionStorage on logout", async () => {
    (globalThis as any).window.location = { pathname: "/campaigns/readiness", search: "?quarter=3&year=2026" };

    await performClientLogout({
      reason: "idle_timeout",
      server: false,
    });

    expect(globalThis.sessionStorage.getItem("vaxplan_login_redirect")).toBe("/campaigns/readiness?quarter=3&year=2026");
    expect((globalThis as any).window.history.replaceState).toHaveBeenCalledWith({}, "", "/login");
  });
});
