import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearClientAuthStorage,
  getLogoutState,
  broadcastLogout,
  LOGOUT_BROADCAST_KEY,
} from "@/lib/authSession";
import { performClientLogout } from "@/lib/logout";

describe("Session Management, Idle Timeout & Logout", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
});
