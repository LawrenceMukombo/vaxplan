import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIdleStore } from "@/lib/idleStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { performClientLogout } from "@/lib/logout";

export function IdleTimeoutController() {
  const { user } = useAuth();
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/me/tenant"], staleTime: Infinity });
  const hasUnsavedChanges = useIdleStore().hasUnsavedChanges;
  
  const [showWarning, setShowWarning] = useState(false);
  const showWarningRef = useRef(false);
  const [countdown, setCountdown] = useState(0);

  // Fetch server configuration
  const { data: sessionConfig } = useQuery<{ idleTimeoutMinutes: number, warningMinutes: number }>({
    queryKey: ["/api/auth/session-config"],
    staleTime: Infinity,
  });

  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const warningId = useRef<NodeJS.Timeout | null>(null);
  const countdownId = useRef<NodeJS.Timeout | null>(null);
  const targetLogoutTimeRef = useRef<number>(0);
  const lastPingTime = useRef<number>(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const getTimeoutMinutes = useCallback(() => {
    const userPref = typeof localStorage !== "undefined" ? localStorage.getItem("vaxplan_user_idle_timeout") : null;
    if (userPref && userPref !== "default") {
      const parsed = parseInt(userPref, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (sessionConfig?.idleTimeoutMinutes && sessionConfig.idleTimeoutMinutes > 0) {
      return sessionConfig.idleTimeoutMinutes;
    }
    const security = tenant?.settings?.security || tenant?.settings || {};
    const globalTimeout = security.idleTimeoutMinutes || 15;
    
    if (user?.role && security.roleIdleTimeouts && security.roleIdleTimeouts[user.role]) {
      return security.roleIdleTimeouts[user.role];
    }
    return globalTimeout;
  }, [tenant, user, sessionConfig]);

  const doLogout = useCallback((reason = "idle_timeout", broadcast = true, server = true) => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    if (warningId.current) {
      clearTimeout(warningId.current);
      warningId.current = null;
    }
    if (countdownId.current) {
      clearInterval(countdownId.current);
      countdownId.current = null;
    }
    setShowWarning(false);
    showWarningRef.current = false;

    void performClientLogout({
      reason,
      broadcast,
      server,
      message: reason === "idle_timeout" ? "Session expired. Please sign in again." : undefined,
    });
  }, []);

  const resetTimer = useCallback((broadcast = true) => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    if (warningId.current) {
      clearTimeout(warningId.current);
      warningId.current = null;
    }
    if (countdownId.current) {
      clearInterval(countdownId.current);
      countdownId.current = null;
    }
    
    setShowWarning(false);
    showWarningRef.current = false;

    const timeoutMinutes = getTimeoutMinutes();
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    // Warning logic: at least 1 minute warning, or 2 minutes if timeout is > 15m
    const warningPeriodMinutes = Math.min(
      timeoutMinutes,
      sessionConfig?.warningMinutes || (timeoutMinutes > 15 ? 2 : 1)
    );
    const warningPeriodMs = warningPeriodMinutes * 60 * 1000;
    const timeUntilWarning = Math.max(0, timeoutMs - warningPeriodMs);

    warningId.current = setTimeout(() => {
      setShowWarning(true);
      showWarningRef.current = true;
      const totalWarningSeconds = Math.max(1, warningPeriodMinutes * 60);
      const targetTime = Date.now() + totalWarningSeconds * 1000;
      targetLogoutTimeRef.current = targetTime;
      setCountdown(totalWarningSeconds);
      
      if (countdownId.current) clearInterval(countdownId.current);
      countdownId.current = setInterval(() => {
        const remainingSec = Math.max(0, Math.ceil((targetLogoutTimeRef.current - Date.now()) / 1000));
        setCountdown(remainingSec);
        if (remainingSec <= 0) {
          if (countdownId.current) {
            clearInterval(countdownId.current);
            countdownId.current = null;
          }
          if (timeoutId.current) {
            clearTimeout(timeoutId.current);
            timeoutId.current = null;
          }
          setShowWarning(false);
          showWarningRef.current = false;
          doLogout("idle_timeout");
        }
      }, 500);
    }, timeUntilWarning);

    timeoutId.current = setTimeout(() => {
      doLogout("idle_timeout");
    }, timeoutMs);

    if (broadcast) {
      try {
        if (channel.current) {
          channel.current.postMessage({ type: "RESET_IDLE" });
        }
      } catch {
        /* ignore broadcast failure */
      }
    }
    
    // Ping server to keep session alive based on actual elapsed time.
    const now = Date.now();
    if (!lastPingTime.current || now - lastPingTime.current >= 60000) {
      lastPingTime.current = now;
      fetch("/api/auth/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }

  }, [getTimeoutMinutes, doLogout, sessionConfig]);

  useEffect(() => {
    if (!user) {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      if (warningId.current) clearTimeout(warningId.current);
      if (countdownId.current) clearInterval(countdownId.current);
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }
    
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel.current = new BroadcastChannel("vaxplan_session_sync");
        channel.current.onmessage = (event) => {
          if (event.data?.type === "RESET_IDLE") {
            resetTimer(false);
          } else if (event.data?.type === "LOGOUT_NOW") {
            doLogout("cross_tab_logout", false, false);
          }
        };
      }
    } catch {
      channel.current = null;
    }

    // Fallback for environments where BroadcastChannel is unavailable or blocked
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "vaxplan_logout_broadcast" && event.newValue) {
        doLogout("cross_tab_logout", false, false);
      }
    };
    window.addEventListener("storage", handleStorage);

    resetTimer();

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    let throttleTimeout: NodeJS.Timeout | null = null;
    
    const handleActivity = () => {
      if (showWarningRef.current) return; // Don't reset if modal is up, unless they click "Stay Signed In"
      
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          resetTimer();
        }, 2000);
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      if (warningId.current) clearTimeout(warningId.current);
      if (countdownId.current) clearInterval(countdownId.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      window.removeEventListener("storage", handleStorage);
      try {
        channel.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, [user?.id, resetTimer, doLogout]);

  const handleStaySignedIn = () => {
    resetTimer();
    fetch("/api/auth/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  };

  const handleSignOutNow = () => {
    doLogout("manual_logout");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={(open) => {
      if (!open) {
        // If user closes dialog without clicking Stay Signed In, sign out
        doLogout("manual_logout");
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Clock className="h-5 w-5" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            You have been inactive. Your session will expire soon for security reasons.
            <div className="text-3xl font-bold text-center my-6 tabular-nums text-foreground">
              {formatTime(countdown)}
            </div>
            {hasUnsavedChanges && (
              <div className="bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm font-medium border border-amber-200 dark:border-amber-800 mb-4">
                You have unsaved changes. Please stay signed in to continue editing, or save your work before leaving.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={handleSignOutNow} className="w-full sm:w-auto">
            Sign Out Now
          </Button>
          <Button onClick={handleStaySignedIn} className="w-full sm:w-auto">
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
